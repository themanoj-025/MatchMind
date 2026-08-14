# Deployment Topology — Match-Mind

## High-Level Architecture

Match-Mind is designed to be deployed as a decoupled system in a containerized environment.

```text
[ Internet / Cloudflare ]
       │
       ▼
[ Load Balancer / Nginx ]
       │
   ┌───┴─────────────────────────┐
   │                             │
[ Frontend CDN ]        [ Backend API (Node.js/Express) ]
(Static Files)               (Multiple Replicas)
                             │       │      │
           ┌─────────────────┘       │      └────────┐
           ▼                         ▼               ▼
   [ Redis Cache ]           [ PostgreSQL ]      [ BullMQ ]
   (Sessions/Mutex/PubSub)   (Primary DB)        (Workers)
```

## Scaling Strategy

1. **Frontend (Vite/React)**:
   - Hosted on CDN (e.g., Vercel, AWS CloudFront, or Cloudflare Pages).
   - High caching at the edge.

2. **Backend (Node.js)**:
   - Stateless servers scaled horizontally across multiple instances or pods (e.g., Kubernetes, AWS ECS, Render).
   - WebSocket (Socket.io) requires sticky sessions or a Redis adapter (`@socket.io/redis-adapter`) to broadcast messages across all backend nodes.
   - Authentication is JWT-based to ensure statelessness.

3. **Database (PostgreSQL)**:
   - Run on managed services (e.g., AWS RDS, Neon, Supabase).
   - Read-replica ready. High-frequency reads like leaderboards can use replicas.

4. **Cache & Queues (Redis)**:
   - Requires a dedicated Redis instance for:
     - Rate-limiting (distributed).
     - Redlock mutex for live auction bids (prevents race conditions).
     - Socket.io Pub/Sub adapter.

5. **Background Workers (BullMQ)**:
   - Separate Node.js process specifically listening to BullMQ queues.
   - Handles asynchronous background tasks like Matchday score compilation without blocking the main API event loop.
