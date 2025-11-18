from django.urls import path
from . import views

urlpatterns = [
    path('', views.seleccionar_grupo_conteo, name='seleccionar_grupo'),

    # AJAX
    path('subzonas/', views.obtener_subzonas, name='obtener_subzonas'),

    # Conteo
    path('conteo/', views.conteo_producto, name='conteo_producto'),
    path('avance/', views.avanzar_conteo, name='avanzar_conteo'),
    path('reiniciar-seleccion/', views.reset_sesion_conteo, name='reset_sesion_conteo'),

    # Comentarios / incidencias
    path('registrar-comentario/', views.registrar_comentario, name='registrar_comentario'),

    # Resumen
    path('resumen/', views.resumen_inventario, name='resumen_inventario'),
    path('resumen/datos/', views.resumen_datos_json, name='resumen_datos_json'),
    path('api/resumen/', views.resumen_datos_json, name='api_resumen'),  # alias compatible

    # Autocomplete
    path('buscar-productos/', views.buscar_productos, name='buscar_productos'),
    path("resumen/exportar/", views.exportar_resumen_excel, name="exportar_resumen_excel"),
    
    path('resumen/productos/', views.resumen_productos, name='resumen_productos'),
    path('resumen/lotes/', views.resumen_lotes, name='resumen_lotes'),
    
    path("resumen/comentarios/", views.listar_comentarios_json, name="listar_comentarios"),

] 