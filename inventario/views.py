from django.http import JsonResponse
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from collections import defaultdict
from .models import Conteo, Zona, Subzona, Inventario, Producto, Lote
from django.db.models import F
from django.utils import timezone
from django.db import connection

def resumen_inventario(request):
    # Simplemente renderiza el template del resumen
    return render(request, 'inventario/resumen_inventario.html')

def resumen_datos_json(request):
    resumen = defaultdict(lambda: defaultdict(dict))

    conteos = Conteo.objects.select_related("lote__producto").order_by(
        'lote_id', 'ubicacion_real', 'grupo', '-numero_conteo', '-fecha'
    )

    for conteo in conteos:
        clave = (conteo.lote_id, conteo.ubicacion_real)
        grupo_key = f'grupo_{conteo.grupo}'

        if grupo_key not in resumen[clave]:
            resumen[clave]['codigo'] = conteo.lote.producto.codigo if conteo.lote and conteo.lote.producto else "-"
            resumen[clave]['producto'] = conteo.lote.producto.nombre if conteo.lote and conteo.lote.producto else "Producto no registrado"
            resumen[clave]['lote'] = conteo.lote.numero_lote if conteo.lote else "-"
            resumen[clave]['ubicacion'] = conteo.ubicacion_real
            resumen[clave][grupo_key] = conteo.cantidad_encontrada
            resumen[clave]['conteo'] = conteo.numero_conteo

            # Buscar la cantidad en Inventario
            try:
                inv = Inventario.objects.get(
                    codigo=resumen[clave]['codigo'],
                    lote=resumen[clave]['lote'],
                    ubicacion=resumen[clave]['ubicacion']
                )
                resumen[clave]['cantidad_sistema'] = inv.cantidad
            except Inventario.DoesNotExist:
                resumen[clave]['cantidad_sistema'] = None

    datos_finales = []
    for _, info in resumen.items():
        datos_finales.append(info)

    return JsonResponse({'data': datos_finales})

# =======================
# Selección de Grupo y Conteo
# =======================
def seleccionar_grupo_conteo(request):
    zonas = Zona.objects.all()
    if request.method == 'POST':
        grupo = request.POST.get('grupo')
        conteo = request.POST.get('conteo')
        return redirect(f'/conteo/?grupo={grupo}&conteo={conteo}')
    return render(request, 'inventario/seleccionar_grupo.html', {'zonas': zonas})


# =======================
# Obtener Subzonas AJAX
# =======================
def obtener_subzonas(request):
    zona_id = request.GET.get("zona")
    if not zona_id:
        return JsonResponse({"subzonas": []})
    
    subzonas = Subzona.objects.filter(zona_id=zona_id).values("id", "nombre")
    return JsonResponse({"subzonas": list(subzonas)})

def conteo_producto(request):
    grupo = request.GET.get("grupo") or request.POST.get("grupo")
    conteo_num = request.GET.get("conteo") or request.POST.get("conteo")
    zona_id = request.GET.get("zona") or request.POST.get("zona")
    subzona_id = request.GET.get("subzona") or request.POST.get("subzona")

    zonas = Zona.objects.all()
    subzonas = Subzona.objects.filter(zona_id=zona_id) if zona_id else []

    inventario_lista = []

    if zona_id and subzona_id:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT 
                    inv.id AS inventario_id,
                    p.codigo AS codigo_producto,
                    p.nombre AS nombre_producto,
                    l.numero_lote,
                    inv.ubicacion,  
                    inv.cantidad
                FROM inventario_inventario inv
                JOIN inventario_lote l
                    ON CAST(inv.lote AS bigint) = l.id
                JOIN inventario_producto p
                    ON l.producto_id = p.id
                WHERE inv.ubicacion IS NOT NULL 
                  AND inv.ubicacion <> ''
                  AND CAST(inv.ubicacion AS TEXT) LIKE %s
            """, [f"%{subzona_id}%"])

            rows = cursor.fetchall()

            for row in rows:
                inventario_lista.append({
                    "id": row[0],
                    "codigo": row[1],
                    "producto_nombre": row[2],
                    "lote": row[3],
                    "ubicacion": row[4],
                    "cantidad": row[5]
                })

    if request.method == "POST":
        # Obtener nombres de zona y subzona para guardarlos unidos
        zona_nombre = Zona.objects.filter(id=zona_id).values_list("nombre", flat=True).first()
        subzona_nombre = Subzona.objects.filter(id=subzona_id).values_list("nombre", flat=True).first()
        ubicacion_final = f"{zona_nombre} - {subzona_nombre}" if zona_nombre and subzona_nombre else None

        for item in inventario_lista:
            cantidad_contada = request.POST.get(f"cantidad_contada_{item['id']}")
            if cantidad_contada and cantidad_contada.strip() != "":
                lote_obj = Lote.objects.filter(numero_lote=item['lote']).first()
                if not lote_obj:
                    # ❌ Eliminado el producto genérico, si no existe lote no se registra
                    continue

                Conteo.objects.create(
                    grupo=int(grupo),
                    numero_conteo=int(conteo_num),
                    cantidad_encontrada=cantidad_contada,
                    ubicacion_real=ubicacion_final or item['ubicacion'],
                    comentario=request.POST.get("incidencia_comentario", ""),
                    lote=lote_obj
                )

        messages.success(request, "Conteo registrado correctamente")
        return redirect(f"{request.path}?grupo={grupo}&conteo={conteo_num}&zona={zona_id}&subzona={subzona_id}")

    # 🔹 Siempre retornar algo para evitar el pantallazo amarillo
    return render(request, "inventario/conteo_producto.html", {
        "grupo": grupo,
        "conteo": conteo_num,
        "zonas": zonas,
        "subzonas": subzonas,
        "zona_seleccionada": zona_id,
        "subzona_seleccionada": subzona_id,
        "inventario": inventario_lista
    })