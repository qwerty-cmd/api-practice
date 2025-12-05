# API Practice Project

Practice API calls with rate limiting, error handling, caching, validation, and authentication.

## Setup

```bash
npm install axios express
```

## Files

### 1. `stock-api-practice.js`

Practice with real Alpha Vantage stock API:

- Rate limiting
- Caching
- Error handling with retry
- Exponential backoff

**Get free API key**: https://www.alphavantage.co/support/#api-key

```bash
node stock-api-practice.js
```

### 2. `crud-practice.js`

Practice CRUD operations with JSONPlaceholder:

- GET requests
- POST requests (create)
- PUT requests (full update)
- PATCH requests (partial update)
- DELETE requests

```bash
node crud-practice.js
```

### 3. `mock-server.js`

Run your own mock API server:

- Rate limiting (10 req/min)
- Random errors (10% chance)
- Full CRUD operations
- **Authentication** (Bearer tokens)
- **Role-based access control** (user vs admin)

**Credentials:**

- Test User: `username: testuser, password: password123`
- Admin: `username: admin, password: admin123`

**Start server:**

```bash
node mock-server.js
```

### 4. `validation-practice.js`

Practice input validation and sanitization:

- Schema-based validation
- Custom validators (email, stock symbols, dates, prices)
- Data sanitization
- Error messages
- Multiple validation errors

```bash
node validation-practice.js
```

### 5. `auth-practice.js`

Practice different authentication methods:

- **Basic Auth** (username:password base64)
- **Bearer Token** (JWT)
- **API Key** (query params & headers)
- **OAuth 2.0** (token refresh flow)
- **Session-based** (cookies)
- **HMAC Signature** (AWS-style)
- **Complete client** with auto token refresh

```bash
node auth-practice.js
```

## Practice Exercises

### Basic

1. **Rate Limiting**: Make 20 requests quickly and handle the 429 errors
2. **Retry Logic**: Implement exponential backoff when API fails
3. **Caching**: Cache responses for 5 minutes to reduce API calls

### Intermediate

4. **Error Handling**: Handle network errors, timeouts, and API errors
5. **Batch Requests**: Fetch multiple stocks in parallel with Promise.all()
6. **Validation**: Validate all user inputs before making API calls

### Advanced

7. **Authentication Flow**: Login → get token → make requests → refresh token
8. **Circuit Breaker**: Stop making requests after multiple failures
9. **Request Queue**: Queue requests and process them with delays
10. **Role-based access**: Test user vs admin permissions

## Concepts to Practice

- ✅ GET, POST, PUT, PATCH, DELETE
- ✅ Rate limiting (queue-based)
- ✅ Caching (in-memory)
- ✅ Error handling (try/catch, retry logic)
- ✅ Async/await patterns
- ✅ Promise.all() for parallel requests
- ✅ Exponential backoff
- ✅ Timeout handling
- ✅ Input validation & sanitization
- ✅ Authentication (Basic, Bearer, API Key, OAuth2, Session, HMAC)
- ✅ Token management (refresh, expiry)
- ✅ Authorization (role-based access control)
