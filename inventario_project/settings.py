
# inventario_project/settings.py
from pathlib import Path
import os
from dotenv import load_dotenv
import dj_database_url

# =========================
# Paths
# =========================
BASE_DIR = Path(__file__).resolve().parent.parent

# Carga variables de entorno desde .env (local)
load_dotenv()

# =========================
# Núcleo
# =========================
SECRET_KEY = os.getenv('SECRET_KEY', 'valor-local-inseguro')
DEBUG = os.getenv('DEBUG', 'True') == 'True'

ALLOWED_HOSTS = [
    'web-production-ffaf.up.railway.app',
    '.onrender.com',
    'conteo-inventario.onrender.com',
    'localhost',
    '127.0.0.1',
]

# Confianza CSRF (Render + local)
CSRF_TRUSTED_ORIGINS = [
    'https://conteo-inventario.onrender.com',
    'https://*.onrender.com',
    'http://localhost',
    'http://127.0.0.1',
]

# Si Render expone el hostname público, añádelo automáticamente
RENDER_EXTERNAL_HOSTNAME = os.getenv("RENDER_EXTERNAL_HOSTNAME")
if RENDER_EXTERNAL_HOSTNAME:
    ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOSTNAME)
    CSRF_TRUSTED_ORIGINS.append(f"https://{RENDER_EXTERNAL_HOSTNAME}")

# Evitar problemas de HTTPS detrás del proxy de Render
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

# =========================
# Apps
# =========================
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'inventario',
]

# =========================
# Middleware
# =========================
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # servir estáticos
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'inventario_project.urls'

# =========================
# Templates
# =========================
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],  # p.ej. [BASE_DIR / "templates"]
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'inventario_project.wsgi.application'

# =========================
# Base de Datos (Render / Local fallback)
# =========================
# Prioridad: INTERNAL_DATABASE_URL (Render) → DATABASE_URL (.env/local) → fallback local
DB_URL = (
    os.getenv("INTERNAL_DATABASE_URL")  # Render (internal connection string si aplica)
    or os.getenv("DATABASE_URL")        # Local/externa: del .env
    or (
        f"postgresql://{os.getenv('DB_USER', 'postgres')}:"
        f"{os.getenv('DB_PASSWORD', 'postgres')}@"
        f"{os.getenv('DB_HOST', '127.0.0.1')}:"
        f"{os.getenv('DB_PORT', '5432')}/"
        f"{os.getenv('DB_NAME', 'inventario_db')}"
    )
)

# Render requiere SSL; en local normalmente no (a menos que lo fuerces)
SSL_REQUIRE = os.getenv(
    "DB_SSL_REQUIRE",
    "True" if ("render.com" in DB_URL or "onrender.com" in DB_URL or "sslmode=require" in DB_URL) else "False"
) == "True"

CONN_MAX_AGE = int(os.getenv("DB_CONN_MAX_AGE", "600"))

DATABASES = {
    'default': dj_database_url.parse(
        DB_URL,
        conn_max_age=CONN_MAX_AGE,
        ssl_require=SSL_REQUIRE,
    )
}

# =========================
# Auth
# =========================
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# =========================
# i18n / tz
# =========================
LANGUAGE_CODE = 'es'
TIME_ZONE = 'America/Lima'
USE_I18N = True
USE_TZ = True  # almacena en UTC, convierte a America/Lima en vistas/plantillas

# =========================
# Static & Media
# =========================
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# =========================
# Logging (opcional)
# =========================
if os.getenv("DJANGO_LOG_SQL", "False") == "True":
    LOGGING = {
        'version': 1,
        'disable_existing_loggers': False,
        'handlers': {'console': {'class': 'logging.StreamHandler'}},
        'loggers': {
            'django.db.backends': {'level': 'DEBUG', 'handlers': ['console']},
            'django.request': {'level': 'INFO', 'handlers': ['console']},
        },
    }