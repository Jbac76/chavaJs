/**
 * Cross-Origin Resource Sharing — Laravel's config/cors.php equivalent.
 *
 * The kernel applies these globally. Origins not listed get no CORS headers,
 * so browsers block cross-origin reads. Use '*' to allow any origin (then
 * credentials are automatically disabled per the CORS spec).
 */
export default {
  allowed_origins: ['http://localhost:3000', 'http://localhost:5173'],

  allowed_methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

  allowed_headers: ['Content-Type', 'Authorization', 'X-XSRF-TOKEN', 'Accept'],

  // Send cookies/authorization on cross-origin requests (ignored with '*').
  supports_credentials: true,

  // Preflight cache lifetime in seconds.
  max_age: 86400,
};
