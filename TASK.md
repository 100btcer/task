# Technical Test: API Integration & Blockchain Smart Contract

## Overview

This technical test evaluates your ability to:
1. **Integrate a REST API** with a React frontend using the provided Swagger/OpenAPI specification and Postman collection.
2. **Integrate blockchain smart contract** interactions (read/write) from the same frontend.

Deliverables: a working React application with clear structure, type-safe API client, error handling, and wallet/contract integration.

---

## Part 1: API Integration

### Requirements

- **API client**: Generate or implement a type-safe API client from the Swagger/OpenAPI document.
  - Location: Use the Swagger JSON/YAML provided (e.g. `docs/api-spec.json` or URL).
  - Prefer: OpenAPI codegen (e.g. `openapi-typescript-codegen`, `orval`, or manual types + `fetch`/axios).

- **Project structure** (suggested):
  ```
  src/
    api/           # API client, base config, types
    hooks/         # useApi*, useQuery wrappers
    components/    # UI components
    pages/         # Route-level views
    types/         # Shared TS types
  ```

- **Functionality**:
  - Call at least: **GET** (list/detail), **POST** (create), and one **PUT/PATCH** or **DELETE** from the API.
  - Loading and error states in the UI.
  - Optional: request cancellation, retries, or optimistic updates (document in README).

- **Testing**:
  - Verify endpoints using the provided **Postman collection** before/during implementation.
  - Document in README how to run the API (e.g. local URL) and how to use Postman.

### Acceptance Criteria

- [x] API base URL and auth (if any) are configurable (e.g. env vars).
- [x] Types match the Swagger schema (or generated from it).
- [x] User-facing errors are shown (e.g. toast or inline message).
- [x] README explains how to run the app and hit the API (and Postman).

---

## Part 2: Blockchain Smart Contract Integration

### Requirements

- **Wallet connection**: Allow users to connect a Web3 wallet (e.g. MetaMask) to the app.
- **Contract interaction**:
  - **Read**: Call at least one view/pure contract method (e.g. balance, config, getter) and display the result.
  - **Write**: Trigger at least one state-changing method (e.g. transfer, approve, custom action) and show tx status (pending/success/fail).
- **Network**: Support a specific chain (e.g. Polygon PoS mainnet or a local node). Document the chain and contract address(es) in README.

### Technical Hints

- Use a library such as **ethers.js**, **viem**, or **wagmi** for contract calls and wallet connection.
- Contract ABI and address can be:
  - Hardcoded for the test, or
  - Loaded from a config/env file.
- Show clear feedback: “Connect wallet”, “Wrong network”, “Transaction pending”, “Success” / “Failed”.

### Acceptance Criteria

- [x] User can connect/disconnect wallet and see address (e.g. truncated).
- [x] At least one read from the contract is displayed in the UI.
- [x] At least one write (signed transaction) is implemented with status feedback.
- [x] README states chain ID, contract address, and how to run a local node (if applicable).

---

## Deliverables

1. **Source code** of the React frontend (and any config/scripts).
2. **README.md** including:
   - How to install and run the project.
   - How to configure API base URL (and auth if needed).
   - How to use the provided Swagger and Postman for the API.
   - Chain ID, contract address(es), and how to test blockchain features.
3. **Short notes** (in README or `NOTES.md`) on:
   - Design decisions (e.g. choice of API client, state management).
   - What you would improve with more time (testing, error handling, UX).

---

## Provided Assets

- **Swagger/OpenAPI**: Use this to generate types and client (path or URL to be provided).
- **Postman collection**: Use this to manually test the API; ensure your app aligns with the same endpoints and payloads.

---

## Evaluation

- Code structure and maintainability.
- Correctness of API and contract integration.
- Error handling and user feedback.
- Documentation and clarity of setup instructions.

Good luck.
