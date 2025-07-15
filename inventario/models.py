#inventario/models.py
from django.db import models

class Producto(models.Model):
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
    lote = models.ForeignKey(Lote, on_delete=models.CASCADE)
    etiqueta = models.ForeignKey(Etiqueta, on_delete=models.CASCADE)
    subzona = models.ForeignKey(Subzona, on_delete=models.CASCADE)

    def __str__(self):
        return f"{self.lote.numero_lote} → {self.etiqueta.nombre} → {self.subzona.zona.nombre}-{self.subzona.nombre}"


class Conteo(models.Model):
    lote = models.ForeignKey(Lote, on_delete=models.CASCADE, null=True, blank=True)
    grupo = models.IntegerField()
    numero_conteo = models.IntegerField()
    cantidad_encontrada = models.IntegerField()
    ubicacion_real = models.CharField(max_length=100)  # Obligatoria ahora también en incidencias
    comentario = models.TextField(blank=True, null=True)
    evidencia = models.ImageField(upload_to='evidencias/', blank=True, null=True)
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('lote', 'grupo', 'numero_conteo')

    def __str__(self):
        return f"Grupo {self.grupo} - Conteo {self.numero_conteo} - {self.lote or 'Incidencia'}"