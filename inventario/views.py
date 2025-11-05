# inventario/views.py
from collections import defaultdict
from decimal import Decimal

from django.http import JsonResponse
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.db import connection

from .models import (
    Conteo, Zona, Subzona, Inventario, Producto, Lote, Comentario
)

ALLOWED_GROUPS = {1, 2, 3}

def _sanitize_group(val, default=1):
    g = _as_int(val, default)
    return g if g in ALLOWED_GROUPS else default


# =========================
# Helpers
# =========================
def _param(request, name, default=None):
    """Lee parámetro desde GET o POST; si falta, devuelve default."""
    val = request.GET.get(name)
    if val not in (None, ""):
        return val
    val = request.POST.get(name)
    if val not in (None, ""):
        return val
    return default

def _as_int(val, default):
    """Convierte a int de forma segura."""
    try:
        return int(str(val).strip())
    except (TypeError, ValueError):
        return default

def _to_float(val):
    """Convierte texto a float (admite coma)."""
    if val is None:
        return None
    s = str(val).strip().replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None

def _defaults_zona_subzona():
    """
    Retorna (zona_obj, subzona_obj) por defecto:
    - primera zona por nombre asc
    - primera subzona de esa zona por nombre asc
    Si no hay subzonas, subzona_obj es None.
    """
    zona = Zona.objects.order_by("nombre").first()
    if not zona:
        return None, None
    subzona = Subzona.objects.filter(zona=zona).order_by("nombre").first()
    return zona, subzona

def _coalesce_zona_subzona_from_params(zona_param, subzona_param):
    """
    Acepta nombre o id (string) y devuelve (zona_obj, subzona_obj, zona_nombre, subzona_nombre).
    Intenta por NOMBRE y por ID para soportar subzonas con nombres '1', '2', '3', etc.
    """
    zona_obj = None
    subzona_obj = None

    # ---- ZONA: probar por nombre y luego por id ----
    if zona_param:
        zona_obj = Zona.objects.filter(nombre=str(zona_param)).first()
        if not zona_obj and str(zona_param).isdigit():
            zona_obj = Zona.objects.filter(id=int(zona_param)).first()

    # Defaults si no vino/zona inválida
    if not zona_obj:
        zona_obj, subzona_obj = _defaults_zona_subzona()
    else:
        # ---- SUBZONA: siempre dentro de la zona ----
        if subzona_param:
            # 1) por nombre (soporta nombres '1','2',...)
            subzona_obj = Subzona.objects.filter(
                zona=zona_obj, nombre=str(subzona_param)
            ).first()
            # 2) si no se encontró por nombre y parece id, intenta por id
            if not subzona_obj and str(subzona_param).isdigit():
                subzona_obj = Subzona.objects.filter(
                    zona=zona_obj, id=int(subzona_param)
                ).first()

        # 3) default si sigue vacío
        if not subzona_obj:
            subzona_obj = Subzona.objects.filter(zona=zona_obj).order_by("nombre").first()

    zona_nombre = zona_obj.nombre if zona_obj else None
    subzona_nombre = subzona_obj.nombre if subzona_obj else None
    return zona_obj, subzona_obj, zona_nombre, subzona_nombre


# =========================
# Selección inicial (grupo/conteo) guardado en sesión
# =========================
def seleccionar_grupo_conteo(request):
    if request.method == "POST":
        grupo  = _sanitize_group(request.POST.get("grupo"), _as_int(request.session.get("grupo"), 1))
        conteo = max(1, _as_int(request.POST.get("conteo"), _as_int(request.session.get("conteo"), 1)))
        request.session["grupo"]  = grupo
        request.session["conteo"] = conteo
        messages.success(request, f"Seleccionaste Grupo {grupo} | Conteo N° {conteo}")
        return redirect("conteo_producto")

    ctx = {
        "grupo":  _sanitize_group(request.session.get("grupo"), 1),
        "conteo": max(1, _as_int(request.session.get("conteo"), 1)),
        "allowed_groups": sorted(ALLOWED_GROUPS),
    }
    return render(request, "inventario/seleccionar_grupo.html", ctx)


# =========================
# AJAX: subzonas por zona
# =========================
def obtener_subzonas(request):
    zona_id = request.GET.get("zona")
    if not zona_id:
        return JsonResponse({"subzonas": []})
    subzonas = Subzona.objects.filter(zona_id=zona_id).order_by("nombre").values("id", "nombre")
    return JsonResponse({"subzonas": list(subzonas)})


# =========================
# Conteo por ubicación (usa grupo/conteo y selección zona/subzona)
# =========================
def conteo_producto(request):
    zonas = Zona.objects.all().order_by("nombre")

    grupo  = _as_int(request.session.get("grupo"), 1)
    conteo = _as_int(request.session.get("conteo"), 1)

    # Leer params o sesión
    zona_in  = _param(request, "zona", request.session.get("zona"))
    sub_in   = _param(request, "subzona", request.session.get("subzona"))

    # Resolver a objetos/nombres con defaults
    zona_obj, subzona_obj, zona_nombre, subzona_nombre = _coalesce_zona_subzona_from_params(zona_in, sub_in)

    # Persistir en sesión (ids)
    if zona_obj:
        request.session["zona"] = zona_obj.id
    if subzona_obj:
        request.session["subzona"] = subzona_obj.id

    # Listado de subzonas para el combo
    subzonas = Subzona.objects.filter(zona=zona_obj).order_by("nombre") if zona_obj else Subzona.objects.none()

    inventario_lista = []
    if zona_obj and subzona_obj:
        ubic = f"{zona_nombre}-{subzona_nombre}"
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT inv.id,
                       inv.codigo,
                       COALESCE(p.nombre, inv.codigo) AS producto_nombre,
                       inv.lote,
                       inv.ubicacion,
                       inv.cantidad,
                       c.id AS conteo_id,                        -- ← null si no se ha contado
                       c.cantidad_encontrada AS cantidad_prev    -- ← último valor contado
                FROM inventario_inventario AS inv
                LEFT JOIN inventario_producto AS p
                       ON p.codigo = inv.codigo
                -- Vinculamos lote por (numero_lote + producto) para identificar el lote correcto
                LEFT JOIN inventario_lote AS l
                       ON l.numero_lote = inv.lote
                      AND l.producto_id = p.id
                -- ¿Ya existe conteo para este grupo y #conteo en esta ubicacion?
                LEFT JOIN inventario_conteo AS c
                       ON c.lote_id = l.id
                      AND c.ubicacion_real = inv.ubicacion
                      AND c.grupo = %s
                      AND c.numero_conteo = %s
                WHERE inv.ubicacion = %s
                ORDER BY producto_nombre, inv.lote;
            """, [grupo, conteo, ubic])
            rows = cursor.fetchall()

        for r in rows:
            inventario_lista.append({
                "id": r[0],
                "codigo": r[1],
                "producto_nombre": r[2],
                "lote": r[3],
                "ubicacion": r[4],
                "cantidad": r[5],
                "ya_contado": bool(r[6]),
                "cantidad_prev": r[7],
            })

        # Guardar conteo (POST) — idempotente por grupo/conteo/lote/ubicación
        if request.method == "POST":
            ubic_final = f"{zona_nombre}-{subzona_nombre}"
            guardados = 0

            for item in inventario_lista:
                cantidad_contada = _to_float(request.POST.get(f"cantidad_contada_{item['id']}"))
                if cantidad_contada is None:
                    continue

                # Lote coherente con el producto
                lote_obj = Lote.objects.filter(
                    numero_lote=item["lote"],
                    producto__codigo=item["codigo"]
                ).first()
                if not lote_obj:
                    continue

                # Idempotencia
                Conteo.objects.update_or_create(
                    grupo=grupo,
                    numero_conteo=conteo,
                    lote=lote_obj,
                    ubicacion_real=ubic_final,
                    defaults={"cantidad_encontrada": cantidad_contada},
                )
                guardados += 1

            if guardados:
                messages.success(request, f"Conteo registrado correctamente ({guardados} filas).")
            else:
                messages.warning(request, "No se registró ninguna fila (todas vacías o inválidas).")

            return redirect("conteo_producto")

    return render(request, "inventario/conteo_producto.html", {
        "grupo": grupo,
        "conteo": conteo,
        "zonas": zonas,
        "subzonas": subzonas,
        "zona_seleccionada": zona_obj.id if zona_obj else None,
        "subzona_seleccionada": subzona_obj.id if subzona_obj else None,
        "zona_nombre": zona_nombre,
        "subzona_nombre": subzona_nombre,
        "inventario": inventario_lista,
    })


# =========================
# Avanzar conteo / Reiniciar selección
# =========================
def avanzar_conteo(request):
    request.session["conteo"] = _as_int(request.session.get("conteo"), 1) + 1
    messages.info(request, f"Pasaste al Conteo N° {request.session['conteo']}")
    return redirect("conteo_producto")

def reset_sesion_conteo(request):
    for k in ("grupo", "conteo", "zona", "subzona"):
        request.session.pop(k, None)
    messages.info(request, "Selección reiniciada.")
    return redirect("seleccionar_grupo")


# =========================
# Resumen (por grupo, sin sumar) + consenso 2-de-3
# =========================
TOL = Decimal("0.01")  # tolerancia

def _resumen_rows(zona_nombre=None, subzona_nombre=None, page=1, page_size=200):
    """
    Devuelve filas del resumen, filtradas por zona/subzona si se pasan.
    Soporta paginación con LIMIT/OFFSET.
    """
    # WHERE dinámico
    where = []
    params = []
    if zona_nombre and subzona_nombre:
        where.append("inv.ubicacion = %s")
        params.append(f"{zona_nombre}-{subzona_nombre}")
    elif zona_nombre:
        where.append("inv.ubicacion LIKE %s")
        params.append(f"{zona_nombre}-%")

    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    limit = max(1, int(page_size))
    offset = max(0, (int(page) - 1) * limit)

    with connection.cursor() as cur:
        cur.execute(f"""
WITH inv AS (
  SELECT inv.ubicacion,
         p.nombre       AS producto,
         l.id           AS lote_id,
         l.numero_lote  AS lote,
         inv.cantidad   AS sistema
  FROM inventario_inventario inv
  -- FIX: primero resolvemos el producto por codigo
  LEFT JOIN inventario_producto p
         ON p.codigo = inv.codigo
  -- FIX: luego resolvemos el lote por (numero_lote + producto_id)
  LEFT JOIN inventario_lote l
         ON l.numero_lote = inv.lote
        AND l.producto_id = p.id
  {where_sql}
),
conteos_ult AS (
  SELECT c.ubicacion_real,
         c.lote_id,
         c.grupo,
         c.numero_conteo,
         c.cantidad_encontrada,
         ROW_NUMBER() OVER (
           PARTITION BY c.ubicacion_real, c.lote_id, c.grupo
           ORDER BY c.numero_conteo DESC, c.fecha DESC, c.id DESC
         ) AS rn
  FROM inventario_conteo c
),
c AS (
  SELECT ubicacion_real, lote_id, grupo, numero_conteo, cantidad_encontrada
  FROM conteos_ult
  WHERE rn = 1
)
SELECT i.ubicacion, i.producto, i.lote, i.sistema,
       c1.cantidad_encontrada AS g1, c1.numero_conteo AS g1_n,
       c2.cantidad_encontrada AS g2, c2.numero_conteo AS g2_n,
       c3.cantidad_encontrada AS g3, c3.numero_conteo AS g3_n
FROM inv i
LEFT JOIN c c1 ON c1.lote_id=i.lote_id AND c1.ubicacion_real=i.ubicacion AND c1.grupo=1
LEFT JOIN c c2 ON c2.lote_id=i.lote_id AND c2.ubicacion_real=i.ubicacion AND c2.grupo=2
LEFT JOIN c c3 ON c3.lote_id=i.lote_id AND c3.ubicacion_real=i.ubicacion AND c3.grupo=3
ORDER BY i.ubicacion, i.producto, i.lote
LIMIT %s OFFSET %s
        """, [*params, limit, offset])
        cols = [c[0] for c in cur.description]
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]

    def eq(a, b):
        if a is None or b is None:
            return False
        from decimal import Decimal as _D
        _TOL = _D("0.01")
        return abs(_D(a) - _D(b)) <= _TOL

    items = []
    for r in rows:
        sistema = r["sistema"]
        g1, g2, g3 = r["g1"], r["g2"], r["g3"]

        objetivo = None
        if eq(g1, g2): objetivo = g1
        elif eq(g1, g3): objetivo = g1
        elif eq(g2, g3): objetivo = g2

        llenos = sum(1 for v in (g1, g2, g3) if v is not None)
        if objetivo is not None:
            estado = "OK (consenso)"
        else:
            estado = f"Pendiente • faltan {max(0, 2 - llenos)}" if llenos < 2 else "Pendiente • falta 1 (3er conteo)"

        delta = (Decimal(str(objetivo)) - Decimal(str(sistema))) if objetivo is not None else None

        def _f(v):
            return None if v is None else float(v)
        items.append({
            "ubicacion": r["ubicacion"],
            "producto":  r["producto"],
            "lote":      str(r["lote"]) if r["lote"] is not None else "",
            "sistema":   _f(sistema),
            "g1":        _f(g1), "g1_n": r["g1_n"],
            "g2":        _f(g2), "g2_n": r["g2_n"],
            "g3":        _f(g3), "g3_n": r["g3_n"],
            "objetivo":  _f(objetivo),
            "delta":     _f(delta),
            "estado":    estado,
        })

    return items


def resumen_datos_json(request):
    """
    Endpoint JSON del resumen.
    Acepta filtros:
      - zona: id o nombre
      - subzona: id o nombre
      - page, page_size
    Si no vienen, usa defaults (primera zona/subzona).
    """
    zona_in  = _param(request, "zona", None)
    sub_in   = _param(request, "subzona", None)
    page     = _as_int(_param(request, "page", 1), 1)
    page_sz  = _as_int(_param(request, "page_size", 200), 200)

    # Resolver nombres (con defaults)
    _, _, zona_nombre, subzona_nombre = _coalesce_zona_subzona_from_params(zona_in, sub_in)

    data = _resumen_rows(zona_nombre=zona_nombre, subzona_nombre=subzona_nombre, page=page, page_size=page_sz)
    return JsonResponse({"data": data, "zona": zona_nombre, "subzona": subzona_nombre, "page": page, "page_size": page_sz})


def resumen_inventario(request):
    """
    Render inicial del resumen: la página se pintará con los combos y,
    en el front, hará fetch a resumen_datos_json con la zona/subzona por defecto.
    """
    # Defaults (primera zona + primera subzona)
    zona_obj, subzona_obj = _defaults_zona_subzona()
    ctx = {
        "zonas": Zona.objects.order_by("nombre"),
        "zona_default": zona_obj.nombre if zona_obj else "",
        "subzona_default": subzona_obj.nombre if subzona_obj else "",
    }
    return render(request, "inventario/resumen_inventario.html", ctx)


# =========================
# Comentarios / incidencias
# =========================
def registrar_comentario(request):
    if request.method == "POST":
        grupo  = _as_int(request.session.get("grupo"), 1)
        conteo = _as_int(request.session.get("conteo"), 1)
        zona_id = _as_int(request.session.get("zona"), None)
        sub_id  = _as_int(request.session.get("subzona"), None)

        zona_nombre = Zona.objects.filter(id=zona_id).values_list("nombre", flat=True).first()
        sub_nombre  = Subzona.objects.filter(id=sub_id).values_list("nombre", flat=True).first()
        ubic_final = f"{zona_nombre}-{sub_nombre}" if zona_nombre and sub_nombre else None

        texto = (request.POST.get("incidencia_comentario") or "").strip()
        if texto:
            Comentario.objects.create(
                grupo=grupo,
                numero_conteo=conteo,
                ubicacion_real=ubic_final,
                comentario=texto,
            )
            messages.success(request, "Comentario registrado correctamente")
        else:
            messages.warning(request, "Comentario vacío; no se registró.")
        return redirect("conteo_producto")
    return redirect("seleccionar_grupo")


# =========================
# Autocomplete de productos
# =========================
def buscar_productos(request):
    q = (request.GET.get("q") or "").strip()
    if len(q) < 2:
        return JsonResponse([], safe=False)
    productos = Producto.objects.filter(nombre__icontains=q).order_by("nombre")[:10]
    return JsonResponse([p.nombre for p in productos], safe=False)