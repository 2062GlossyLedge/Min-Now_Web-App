# Security settings
SECURE_SSL_REDIRECT = False  # Railway handles SSL
SECURE_PROXY_SSL_HEADER = (
    "HTTP_X_FORWARDED_PROTO",
    "https",
)  # Tell Django about the proxy
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
