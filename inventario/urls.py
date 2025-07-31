from django.urls import path
from . import views

urlpatterns = [
    path('', views.seleccionar_grupo_conteo, name='seleccionar_grupo'),
    path('conteo/', views.conteo_producto, name='conteo_producto'),
    path('subzonas/', views.obtener_subzonas, name='obtener_subzonas'),
    path('resumen/', views.resumen_inventario, name='resumen_inventario'),
    path('api/resumen/', views.resumen_datos_json, name='resumen_datos_json'),
    path('resumen/', views.resumen_inventario, name='resumen_inventario'),
]