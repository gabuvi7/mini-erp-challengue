using Microsoft.EntityFrameworkCore;
using MiniErp.Core.Data;
using MiniErp.Core.Models;

namespace MiniErp.Core.Services;

public class FacturacionService
{
    private readonly AppDbContext _db;
    private readonly PresupuestoService _presupuestos;
    private readonly NumeracionService _numeracion;

    public FacturacionService(AppDbContext db, PresupuestoService presupuestos, NumeracionService numeracion)
    {
        _db = db;
        _presupuestos = presupuestos;
        _numeracion = numeracion;
    }

    public async Task<Factura> FacturarAsync(int presupuestoId)
    {
        var presupuesto = await _db.Presupuestos
            .Include(p => p.Items)
            .FirstOrDefaultAsync(p => p.Id == presupuestoId)
            ?? throw new InvalidOperationException("El presupuesto no existe.");

        if (presupuesto.Estado == EstadoPresupuesto.Facturado
            || await _db.Facturas.AnyAsync(f => f.PresupuestoId == presupuestoId))
            throw new InvalidOperationException("El presupuesto ya fue facturado.");

        if (presupuesto.Estado != EstadoPresupuesto.Aprobado)
            throw new InvalidOperationException("El presupuesto no está aprobado.");

        var vencimiento = presupuesto.Fecha.AddDays(presupuesto.ValidezDias);
        if (DateTime.UtcNow > vencimiento)
            throw new InvalidOperationException("El presupuesto está vencido y no se puede facturar.");

        if (presupuesto.Items.Count == 0)
            throw new InvalidOperationException("El presupuesto no tiene artículos para facturar.");

        var cantidadesPorArticulo = presupuesto.Items
            .GroupBy(i => i.ArticuloId)
            .ToDictionary(g => g.Key, g => g.Sum(i => i.Cantidad));

        var articuloIds = cantidadesPorArticulo.Keys.ToList();
        var articulos = await _db.Articulos
            .Where(a => articuloIds.Contains(a.Id))
            .ToDictionaryAsync(a => a.Id);

        foreach (var (articuloId, cantidad) in cantidadesPorArticulo)
        {
            if (!articulos.TryGetValue(articuloId, out var articulo))
                throw new InvalidOperationException($"El artículo {articuloId} no existe.");

            if (articulo.StockActual < cantidad)
                throw new InvalidOperationException($"Stock insuficiente para el artículo {articuloId}.");
        }

        var totales = _presupuestos.CalcularTotales(presupuesto);
        var numeroFactura = await _numeracion.ProximoNumeroFacturaAsync();

        foreach (var (articuloId, cantidad) in cantidadesPorArticulo)
            articulos[articuloId].StockActual -= cantidad;

        var factura = new Factura
        {
            Numero = numeroFactura,
            Fecha = DateTime.UtcNow,
            PresupuestoId = presupuesto.Id,
            Subtotal = totales.Subtotal,
            Iva = totales.Iva,
            Total = totales.Total
        };

        presupuesto.Estado = EstadoPresupuesto.Facturado;
        _db.Facturas.Add(factura);

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (EsConflictoDeFacturacion(ex))
        {
            throw new InvalidOperationException("El presupuesto ya fue facturado.", ex);
        }

        return factura;
    }

    private static bool EsConflictoDeFacturacion(DbUpdateException exception)
    {
        return exception.InnerException?.Message.Contains(
            "Facturas.PresupuestoId",
            StringComparison.OrdinalIgnoreCase) == true;
    }
}
