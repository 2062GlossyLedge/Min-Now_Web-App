# Generated by Django 5.2.1 on 2025-05-21 03:35

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('items', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='checkup',
            name='user',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='checkups', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='owneditem',
            name='user',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='owned_items', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AlterUniqueTogether(
            name='checkup',
            unique_together={('user', 'checkup_type')},
        ),
    ]
