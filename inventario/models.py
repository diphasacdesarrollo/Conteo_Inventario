from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal

class Producto(models.Model):
    codigo = models.CharField(max_length=100, unique=True, db_index=True)
    nombre = models.CharField(max_length=255)

    class Meta:
        ordering = ["codigo"]

    def __str__(self):
        return f"{self.codigo} - {self.nombre}"


class Lote(models.Model):
    producto = models.ForeignKey(Producto, on_delete=models.PROTECT, related_name='lotes')
    numero_lote = models.CharField(max_length=100, db_index=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["numero_lote", "producto"], name="uq_lote_numero_producto")
        ]
        ordering = ["numero_lote"]

    def __str__(self):
        return f"{self.numero_lote} ({self.producto.nombre})"


class Etiqueta(models.Model):
    nombre = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return self.nombre


class Zona(models.Model):
    nombre = models.CharField(max_length=10, unique=True, db_index=True)  # Ej: 'J', 'H'

    def __str__(self):
        return self.nombre


class Subzona(models.Model):
    nombre = models.CharField(max_length=10)  # Ej: '12.1', '10.2'
    zona = models.ForeignKey(Zona, on_delete=models.PROTECT, related_name="subzonas")

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["nombre", "zona"], name="uq_subzona_nombre_zona")
        ]
        indexes = [models.Index(fields=["zona", "nombre"])]
        ordering = ["zona", "nombre"]

    def __str__(self):
        return f"{self.zona.nombre}-{self.nombre}"


class Inventario(models.Model):
    # snapshot desnormalizado para consultas rápidas y carga por SQL
    codigo = models.CharField(max_length=50, db_index=True)              # -> Producto.codigo
    lote = models.CharField(max_length=50, default="SIN-LOTE", db_index=True)  # -> Lote.numero_lote
    ubicacion = models.CharField(max_length=100, default="SIN-UBICACION", db_index=True)  # "J-12.1"
    cantidad = models.DecimalField(
        max_digits=12, decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0"))]
    )

    class Meta:
        ordering = ["ubicacion", "lote"]
        # Si en algún momento quieres consolidar y evitar duplicados:
        # constraints = [models.UniqueConstraint(fields=["lote", "ubicacion"], name="uq_inv_lote_ubicacion")]

    def __str__(self):
        return f"{self.codigo} - {self.lote} ({self.ubicacion})"


class Conteo(models.Model):
    grupo = models.IntegerField(db_index=True)
    numero_conteo = models.IntegerField(db_index=True)
    cantidad_encontrada = models.DecimalField(
        max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0"))]
    )
    ubicacion_real = models.CharField(max_length=100)
    comentario = models.TextField(blank=True, null=True)
    evidencia = models.CharField(max_length=100, blank=True, null=True)
    fecha = models.DateTimeField(auto_now_add=True)
    lote = models.ForeignKey(Lote, on_delete=models.PROTECT, related_name='conteos')

    class Meta:
        indexes = [models.Index(fields=["grupo", "numero_conteo"]), models.Index(fields=["lote"])]

    def __str__(self):
        return f"Conteo {self.numero_conteo} Grupo {self.grupo} - Lote {self.lote.numero_lote}"


class Comentario(models.Model):
    grupo = models.IntegerField(db_index=True)
    numero_conteo = models.IntegerField(db_index=True)
    ubicacion_real = models.CharField(max_length=255, null=True, blank=True)
    comentario = models.TextField()
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["grupo", "numero_conteo"])]

    def __str__(self):
        return f"Comentario #{self.id} - Grupo {self.grupo} - Conteo {self.numero_conteo}"