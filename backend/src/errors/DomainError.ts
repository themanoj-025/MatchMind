export class DomainError extends Error {
  public code: string;
  public statusCode: number;

  constructor(message: string, code: string, statusCode: number = 400) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ConcurrencyError extends DomainError {
  constructor(message: string = 'State was modified by another transaction') {
    super(message, 'CONCURRENCY_ERROR', 409);
  }
}

export class AuctionError extends DomainError {
  constructor(message: string, code: string = 'AUCTION_ERROR') {
    super(message, code, 400);
  }
}
