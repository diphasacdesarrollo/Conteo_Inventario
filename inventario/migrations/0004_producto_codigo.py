# Generated by Django 5.2.3 on 2025-07-25 15:34

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventario', '0003_alter_conteo_lote'),
    ]

    operations = [
        migrations.AddField(
            model_name='producto',
            name='codigo',
            field=models.CharField(default='sin_codigo', max_length=100),
            preserve_default=False,
        ),
    ]
