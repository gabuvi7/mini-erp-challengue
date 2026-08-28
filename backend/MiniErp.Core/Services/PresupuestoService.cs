using Microsoft.EntityFrameworkCore;
using MiniErp.Core.Data;
using MiniErp.Core.Models;

namespace MiniErp.Core.Services;

public record Totales(decimal Subtotal, decimal Iva, decimal Total);

public class PresupuestoService
{
    private readonly AppDbContext _db;
    private readonly NumeracionService _numeracion;

    public PresupuestoService(AppDbContext db, NumeracionService numeracion)
    {
        _db = db;
        _numeracion = numeracion;
    }

    /// <summary>
    /// Calcula subtotal, IVA y total de un presupuesto. El descuento se aplica
    /// por linea antes del IVA.
    /// </summary>
    public Totales CalcularTotales(Presupuesto presupuesto)
    {
        decimal subtotal = 0m;
        decimal iva = 0m;

        foreach (var item in presupuesto.Items)
        {
            var subtotalLinea = item.Cantidad * item.PrecioUnitario * (1 - item.DescuentoPct / 100m);
            subtotal += subtotalLinea;
            iva += decimal.Round(subtotalLinea * item.AlicuotaIva / 100m, 2, MidpointRounding.AwayFromZero);
        }

        var total = subtotal + iva;

        return new Totales(subtotal, iva, total);
    }

    public async Task<Presupuesto> CrearAsync(int clienteId, int validezDias, List<PresupuestoItem> items)
    {
        if (items is null || items.Count == 0)
            throw new InvalidOperationException("El presupuesto debe tener al menos un artículo.");

        if (validezDias <= 0)
            throw new InvalidOperationException("La validez debe ser mayor que cero días.");

        if (!await _db.Clientes.AnyAsync(c => c.Id == clienteId))
            throw new InvalidOperationException($"El cliente {clienteId} no existe.");

        foreach (var item in items)
        {
            if (item.Cantidad <= 0)
                throw new InvalidOperationException("La cantidad de cada artículo debe ser mayor que cero.");

            if (item.DescuentoPct < 0m || item.DescuentoPct > 100m)
                throw new InvalidOperationException("El descuento debe estar entre 0 y 100.");
        }

        var articuloIds = items.Select(i => i.ArticuloId).Distinct().ToList();
        var articulos = await _db.Articulos
            .Where(a => articuloIds.Contains(a.Id))
            .ToDictionaryAsync(a => a.Id);

        foreach (var item in items)
        {
            if (!articulos.TryGetValue(item.ArticuloId, out var articulo))
                throw new InvalidOperationException($"El artículo {item.ArticuloId} no existe.");

            item.PrecioUnitario = articulo.PrecioUnitario;
            item.AlicuotaIva = articulo.AlicuotaIva;
        }

        var presupuesto = new Presupuesto
        {
            Numero = await _numeracion.ProximoNumeroPresupuestoAsync(),
            Fecha = DateTime.UtcNow,
            ClienteId = clienteId,
            Estado = EstadoPresupuesto.Aprobado,
            ValidezDias = validezDias,
            Items = items
        };

        _db.Presupuestos.Add(presupuesto);
        await _db.SaveChangesAsync();
        return presupuesto;
    }

    public async Task<Presupuesto?> ObtenerAsync(int id)
    {
        return await _db.Presupuestos
            .Include(p => p.Cliente)
            .Include(p => p.Items)
                .ThenInclude(i => i.Articulo)
            .FirstOrDefaultAsync(p => p.Id == id);
    }

    public async Task<List<Presupuesto>> ListarAsync()
    {
        return await _db.Presupuestos
            .Include(p => p.Cliente)
            .Include(p => p.Items)
                .ThenInclude(i => i.Articulo)
            .Where(p => p.Estado != EstadoPresupuesto.Borrador)
            .OrderByDescending(p => p.Numero)
            .ToListAsync();
    }

    public async Task EliminarAsync(int id)
    {
        var presupuesto = await _db.Presupuestos.FindAsync(id);
        if (presupuesto is not null)
        {
            _db.Presupuestos.Remove(presupuesto);
            await _db.SaveChangesAsync();
        }
    }
}
