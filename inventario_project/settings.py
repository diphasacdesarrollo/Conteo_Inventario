# inventario_project/settings.py
from pathlib import Path
import os
from dotenv import load_dotenv
import dj_database_url

# =========================
# Paths
# =========================
BASE_DIR = Path(__file__).resolve().parent.parent

# Carga variables de entorno desde .env (solo local)
load_dotenv()

# =========================
# Núcleo
# =========================
SECRET_KEY = os.getenv('SECRET_KEY', 'valor-local-inseguro')
DEBUG = os.getenv('DEBUG', 'True') == 'True'

ALLOWED_HOSTS = [
    'web-production-ffaf.up.railway.app',  # Railway
    'localhost',
    '127.0.0.1',
]

CSRF_TRUSTED_ORIGINS = [
    'https://web-production-ffaf.up.railway.app',
    'http://localhost',
    'http://127.0.0.1',
]

# Seguridad detrás de proxy (Railway)
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

# IMPORTANTE: faltaba en tu segundo archivo
ROOT_URLCONF = 'inventario_project.urls'

# =========================
# Templates (corregido)
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
# Base de Datos (Railway / Local)
# =========================
# En Railway, define DATABASE_URL en Variables (formato postgres://... o postgresql://...)
DB_URL = os.getenv("DATABASE_URL")

DATABASES = {
    'default': dj_database_url.config(
        default=DB_URL,
        conn_max_age=600,
        ssl_require=True  # fuerza sslmode=require automáticamente
    )
}

# (Opcional/explicito) Si quieres dejarlo clarísimo:
DATABASES['default'].setdefault('OPTIONS', {})
DATABASES['default']['OPTIONS']['sslmode'] = 'require'

# =========================
# Validadores de contraseña
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
USE_TZ = True  # guarda en UTC y convierte a America/Lima

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