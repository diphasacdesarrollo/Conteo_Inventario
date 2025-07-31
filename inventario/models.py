# inventario/models.py
from django.db import models

class Producto(models.Model):
    codigo = models.CharField(max_length=100)
    nombre = models.CharField(max_length=255)

    def __str__(self):
        return f"{self.codigo} - {self.nombre}"


class Lote(models.Model):
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE, related_name='lotes')
    numero_lote = models.CharField(max_length=100)

    def __str__(self):
        return f"{self.numero_lote} ({self.producto.nombre})"


class Etiqueta(models.Model):
    nombre = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return self.nombre


class Zona(models.Model):
    nombre = models.CharField(max_length=10, unique=True)  # Ej: 'J', 'H'

    def __str__(self):
        return self.nombre


class Subzona(models.Model):
    nombre = models.CharField(max_length=10)  # Ej: '12.1', '10.2'
    zona = models.ForeignKey(Zona, on_delete=models.CASCADE)

    class Meta:
        unique_together = ('nombre', 'zona')

    def __str__(self):
        return f"{self.zona.nombre}-{self.nombre}"


class Inventario(models.Model):
    codigo = models.CharField(max_length=50)
    lote = models.CharField(max_length=50, default="SIN-LOTE")
    ubicacion = models.CharField(max_length=100, default="SIN-UBICACION")  # Aquí se guarda "J-12.1"
    cantidad = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    def __str__(self):
        return f"{self.codigo} - {self.lote} ({self.ubicacion})"


class Conteo(models.Model):
    grupo = models.IntegerField()
    numero_conteo = models.IntegerField()
    cantidad_encontrada = models.DecimalField(max_digits=10, decimal_places=2)
    ubicacion_real = models.CharField(max_length=100)
    comentario = models.TextField(blank=True, null=True)
    evidencia = models.CharField(max_length=100, blank=True, null=True)
    fecha = models.DateTimeField(auto_now_add=True)
    lote = models.ForeignKey('Lote', on_delete=models.CASCADE, related_name='conteos')

    def __str__(self):
        return f"Conteo {self.numero_conteo} Grupo {self.grupo} - Lote {self.lote.numero_lote}"