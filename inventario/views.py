#inventario/views.py
from django.http import JsonResponse
from django.shortcuts import render, redirect
from .models import Conteo, Zona, Subzona, Inventario, Lote
from django.contrib import messages
from collections import defaultdict

def resumen_inventario(request):
    return render(request, 'inventario/resumen_inventario.html')

def resumen_datos_json(request):
    resumen = defaultdict(lambda: defaultdict(dict))

    conteos = Conteo.objects.select_related('lote__producto').order_by(
        'lote_id', 'ubicacion_real', 'grupo', '-numero_conteo', '-fecha'
    )

    for conteo in conteos:
        clave = (conteo.lote_id, conteo.ubicacion_real)
        grupo_key = f'grupo_{conteo.grupo}'

        if grupo_key not in resumen[clave]:
            if conteo.lote and conteo.lote.producto:
                resumen[clave]['producto'] = str(conteo.lote.producto).replace('sin_codigo - ', '')
                resumen[clave]['codigo'] = f"LOTE-{conteo.lote_id}"
                resumen[clave]['lote'] = conteo.lote.numero_lote
            else:
                resumen[clave]['producto'] = "Producto no registrado"
                resumen[clave]['codigo'] = "-"
                resumen[clave]['lote'] = "-"
            
            resumen[clave]['ubicacion'] = conteo.ubicacion_real
            resumen[clave][grupo_key] = conteo.cantidad_encontrada
            resumen[clave]['imagen'] = conteo.evidencia.url if conteo.evidencia else ''

    datos_finales = []
    for (lote_id, ubicacion), info in resumen.items():
        grupos = sorted([k for k in info if k.startswith('grupo_')])
        cantidades = [info[k] for k in grupos if isinstance(info[k], int)]
        final = cantidades[-1] if cantidades else None
        datos_finales.append({**info, 'final': final})

    return JsonResponse({'data': datos_finales})


def conteo_producto(request):
    grupo = request.GET.get("grupo")
    conteo = request.GET.get("conteo")
    zona_seleccionada = request.GET.get("zona")
    subzona_id = request.GET.get("subzona")

    zonas = Zona.objects.all()
    subzonas = Subzona.objects.filter(zona__nombre=zona_seleccionada) if zona_seleccionada else []
    inventario_qs = Inventario.objects.filter(subzona__id=subzona_id) if subzona_id else []

    datos_formulario = {}
    comentario_guardado = ""

    if request.method == "POST":
        cantidad_valida = any(request.POST.get(f'cantidad_{item.id}', '').strip() for item in inventario_qs)
        comentario = request.POST.get('incidencia_comentario', '').strip()
        evidencia_libre = request.FILES.get('incidencia_evidencia')
        comentario_guardado = comentario

        if not cantidad_valida and not (comentario and evidencia_libre):
            messages.error(request, "Debes ingresar al menos un producto con cantidad o una incidencia con comentario y evidencia.")
            return render(request, 'inventario/conteo_producto.html', {
                "zonas": zonas,
                "subzonas": subzonas,
                "zona_seleccionada": zona_seleccionada,
                "subzona_seleccionada": subzona_id,
                "inventario": inventario_qs,
                "grupo": grupo,
                "conteo": conteo,
                "datos_formulario": datos_formulario,
                "comentario_guardado": comentario_guardado
            })

        if cantidad_valida and (comentario and evidencia_libre):
            messages.info(request, "Se detectaron productos contados y también una incidencia. Ambos serán registrados.")

        hay_datos = False

        # Procesar productos encontrados
        for item in inventario_qs:
            cantidad_str = request.POST.get(f'cantidad_{item.id}')
            evidencia = request.FILES.get(f'evidencia_{item.id}')
            datos_formulario[f'cantidad_{item.id}'] = cantidad_str

            try:
                cantidad = int(cantidad_str)
                if cantidad <= 0:
                    continue
            except (ValueError, TypeError):
                messages.error(request, f"Cantidad inválida para el lote {item.lote.numero_lote}.")
                continue

            if not evidencia:
                messages.error(request, f"No se registró el conteo del lote {item.lote.numero_lote} porque falta la evidencia.")
                continue

            hay_datos = True

            Conteo.objects.update_or_create(
                lote=item.lote,
                grupo=int(grupo),
                numero_conteo=int(conteo),
                defaults={
                    'cantidad_encontrada': cantidad,
                    'evidencia': evidencia,
                    'ubicacion_real': item.subzona.nombre
                }
            )

        # Si también se ingresó una incidencia junto con productos, registrar adicionalmente
        if cantidad_valida and comentario and evidencia_libre:
            subzona_obj = Subzona.objects.filter(id=subzona_id).first()
            Conteo.objects.create(
                grupo=int(grupo),
                numero_conteo=int(conteo),
                cantidad_encontrada=0,
                ubicacion_real=subzona_obj.nombre if subzona_obj else "No definida",
                comentario=comentario,
                evidencia=evidencia_libre,
            )
            hay_datos = True

        # Si solo hay incidencia (sin conteo)
        if not hay_datos and (comentario or evidencia_libre):
            if not comentario or not evidencia_libre:
                messages.error(request, "Para reportar un producto fuera del sistema, debes ingresar comentario y adjuntar evidencia.")
                return render(request, 'inventario/conteo_producto.html', {
                    ...
                })

            subzona_obj = Subzona.objects.filter(id=subzona_id).first()
            Conteo.objects.create(
                grupo=int(grupo),
                numero_conteo=int(conteo),
                cantidad_encontrada=0,
                ubicacion_real=subzona_obj.nombre if subzona_obj else "No definida",
                comentario=comentario,
                evidencia=evidencia_libre,
            )
            messages.success(request, "Incidencia registrada correctamente.")  # <-- NUEVO
            return redirect(request.get_full_path())

        if not hay_datos:
            messages.error(request, "Debes ingresar al menos un conteo con evidencia o reportar un producto fuera del sistema.")
            return render(request, 'inventario/conteo_producto.html', {
                "zonas": zonas,
                "subzonas": subzonas,
                "zona_seleccionada": zona_seleccionada,
                "subzona_seleccionada": subzona_id,
                "inventario": inventario_qs,
                "grupo": grupo,
                "conteo": conteo,
                "datos_formulario": datos_formulario,
                "comentario_guardado": comentario_guardado
            })

        messages.success(request, "Conteo registrado correctamente.")
        return redirect(request.get_full_path())

    return render(request, 'inventario/conteo_producto.html', {
        "zonas": zonas,
        "subzonas": subzonas,
        "zona_seleccionada": zona_seleccionada,
        "subzona_seleccionada": subzona_id,
        "inventario": inventario_qs,
        "grupo": grupo,
        "conteo": conteo
    })

def seleccionar_grupo_conteo(request):
    zonas = Zona.objects.all()
    if request.method == 'POST':
        grupo = request.POST.get('grupo')
        conteo = request.POST.get('conteo')
        return redirect(f'/conteo/?grupo={grupo}&conteo={conteo}')
    return render(request, 'inventario/seleccionar_grupo.html', {'zonas': zonas})

def obtener_subzonas(request):
    zona_nombre = request.GET.get('zona')
    subzonas = []

    if zona_nombre:
        subzonas_qs = Subzona.objects.filter(zona__nombre=zona_nombre).order_by('nombre')
        subzonas = [{'id': s.id, 'nombre': s.nombre} for s in subzonas_qs]

    return JsonResponse({'subzonas': subzonas})