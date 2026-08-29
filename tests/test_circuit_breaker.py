"""Tests for Match-Mind circuit_breaker.py."""

from __future__ import annotations

import asyncio
import time

import pytest

from circuit_breaker import CircuitBreaker, CircuitBreakerOpenError, CircuitState


class TestCircuitBreakerInit:
    """Tests for CircuitBreaker initialization."""

    def test_default_init(self) -> None:
        cb = CircuitBreaker()
        assert cb.failure_threshold == 5
        assert cb.recovery_timeout == 60.0
        assert cb.name == "default"

    def test_custom_init(self) -> None:
        cb = CircuitBreaker(failure_threshold=3, recovery_timeout=10.0, name="test")
        assert cb.failure_threshold == 3
        assert cb.recovery_timeout == 10.0
        assert cb.name == "test"

    def test_initial_state_is_closed(self) -> None:
        cb = CircuitBreaker()
        assert cb.state == CircuitState.CLOSED
        assert not cb.is_open()


class TestRecordSuccess:
    """Tests for record_success."""

    def test_success_resets_failure_count(self) -> None:
        cb = CircuitBreaker(failure_threshold=3)
        cb.record_failure()
        cb.record_failure()
        cb.record_success()
        assert cb._failure_count == 0

    def test_success_increments_success_count(self) -> None:
        cb = CircuitBreaker()
        cb.record_success()
        assert cb._success_count == 1

    def test_success_transitions_half_open_to_closed(self) -> None:
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=0.01)
        cb.record_failure()  # CLOSED -> OPEN
        assert cb._state == CircuitState.OPEN
        time.sleep(0.02)
        _ = cb.state  # OPEN -> HALF_OPEN
        assert cb.state == CircuitState.HALF_OPEN
        cb.record_success()  # HALF_OPEN -> CLOSED
        assert cb.state == CircuitState.CLOSED

    def test_success_does_not_change_closed_state(self) -> None:
        cb = CircuitBreaker()
        cb.record_success()
        assert cb.state == CircuitState.CLOSED


class TestRecordFailure:
    """Tests for record_failure."""

    def test_single_failure_stays_closed(self) -> None:
        cb = CircuitBreaker(failure_threshold=5)
        cb.record_failure()
        assert cb.state == CircuitState.CLOSED

    def test_failure_opens_at_threshold(self) -> None:
        cb = CircuitBreaker(failure_threshold=3)
        cb.record_failure()
        cb.record_failure()
        cb.record_failure()
        assert cb._state == CircuitState.OPEN
        assert cb.is_open()

    def test_failure_records_timestamp(self) -> None:
        cb = CircuitBreaker(failure_threshold=1)
        before = time.monotonic()
        cb.record_failure()
        after = time.monotonic()
        assert before <= cb._last_failure_time <= after


class TestStateTransitions:
    """Tests for state machine transitions."""

    def test_closed_to_open(self) -> None:
        cb = CircuitBreaker(failure_threshold=2)
        assert cb.state == CircuitState.CLOSED
        cb.record_failure()
        assert cb.state == CircuitState.CLOSED
        cb.record_failure()
        assert cb._state == CircuitState.OPEN

    def test_open_to_half_open_after_timeout(self) -> None:
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=0.01)
        cb.record_failure()  # CLOSED -> OPEN
        assert cb.state == CircuitState.OPEN
        time.sleep(0.02)
        assert cb.state == CircuitState.HALF_OPEN

    def test_half_open_to_closed_on_success(self) -> None:
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=0.01)
        cb.record_failure()
        time.sleep(0.02)
        _ = cb.state  # trigger HALF_OPEN
        cb.record_success()
        assert cb.state == CircuitState.CLOSED

    def test_half_open_to_open_on_failure(self) -> None:
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=0.01)
        cb.record_failure()
        time.sleep(0.02)
        _ = cb.state  # trigger HALF_OPEN
        cb.record_failure()  # HALF_OPEN -> OPEN
        assert cb._state == CircuitState.OPEN

    def test_open_stays_open_before_timeout(self) -> None:
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=60.0)
        cb.record_failure()
        assert cb.state == CircuitState.OPEN
        assert cb.state == CircuitState.OPEN  # still open


class TestAsyncDecorator:
    """Tests for the async decorator pattern."""

    @pytest.mark.asyncio
    async def test_decorator_calls_function(self) -> None:
        cb = CircuitBreaker(failure_threshold=3)

        @cb
        async def my_func(x: int) -> int:
            return x * 2

        result = await my_func(5)
        assert result == 10

    @pytest.mark.asyncio
    async def test_decorator_records_success(self) -> None:
        cb = CircuitBreaker(failure_threshold=3)

        @cb
        async def my_func() -> str:
            return "ok"

        await my_func()
        assert cb._success_count == 1
        assert cb._failure_count == 0

    @pytest.mark.asyncio
    async def test_decorator_records_failure(self) -> None:
        cb = CircuitBreaker(failure_threshold=3)

        @cb
        async def my_func() -> None:
            raise ValueError("test error")

        with pytest.raises(ValueError, match="test error"):
            await my_func()
        assert cb._failure_count == 1

    @pytest.mark.asyncio
    async def test_decorator_blocks_when_open(self) -> None:
        cb = CircuitBreaker(failure_threshold=1)

        @cb
        async def my_func() -> str:
            return "ok"

        # Trip the breaker
        @cb
        async def failing_func() -> None:
            raise ValueError("fail")

        with pytest.raises(ValueError):
            await failing_func()

        # Now the breaker is open
        with pytest.raises(CircuitBreakerOpenError):
            await my_func()

    @pytest.mark.asyncio
    async def test_decorator_reraises_circuit_breaker_error(self) -> None:
        cb = CircuitBreaker(failure_threshold=1)

        @cb
        async def failing_func() -> None:
            raise ValueError("fail")

        with pytest.raises(ValueError):
            await failing_func()

        # The CircuitBreakerOpenError should not be caught by the general exception handler
        with pytest.raises(CircuitBreakerOpenError):
            await failing_func()


class TestContextManager:
    """Tests for the context manager pattern."""

    def test_context_manager_enter_exit_no_error(self) -> None:
        cb = CircuitBreaker(failure_threshold=3)
        with cb:
            pass
        assert cb._success_count == 1

    def test_context_manager_records_failure_on_exception(self) -> None:
        cb = CircuitBreaker(failure_threshold=3)
        with pytest.raises(ValueError):
            with cb:
                raise ValueError("test")
        assert cb._failure_count == 1

    def test_context_manager_blocks_when_open(self) -> None:
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=60.0)
        # Trip the breaker
        with pytest.raises(ValueError):
            with cb:
                raise ValueError("fail")

        # Now open — should raise CircuitBreakerOpenError
        with pytest.raises(CircuitBreakerOpenError):
            with cb:
                pass


class TestCircuitBreakerOpenError:
    """Tests for the exception class."""

    def test_is_exception(self) -> None:
        assert issubclass(CircuitBreakerOpenError, Exception)

    def test_message(self) -> None:
        err = CircuitBreakerOpenError("test message")
        assert str(err) == "test message"
