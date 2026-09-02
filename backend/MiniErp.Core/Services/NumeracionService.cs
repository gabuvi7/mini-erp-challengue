using System.Data;
using Microsoft.EntityFrameworkCore;
using MiniErp.Core.Data;

namespace MiniErp.Core.Services;

public class NumeracionService
{
    private readonly AppDbContext _db;

    public NumeracionService(AppDbContext db) => _db = db;

    public async Task<int> ProximoNumeroPresupuestoAsync()
    {
        return await ProximoNumeroAsync("presupuesto", "Presupuestos");
    }

    public async Task<int> ProximoNumeroFacturaAsync()
    {
        return await ProximoNumeroAsync("factura", "Facturas");
    }

    private async Task<int> ProximoNumeroAsync(string clave, string tabla)
    {
        var connection = _db.Database.GetDbConnection();
        var shouldClose = connection.State == ConnectionState.Closed;

        if (shouldClose)
            await connection.OpenAsync();

        try
        {
            await using var command = connection.CreateCommand();
            command.CommandText = $"""
                INSERT INTO "Numeraciones" ("Clave", "UltimoNumero")
                VALUES ($clave, COALESCE((SELECT MAX("Numero") FROM "{tabla}"), 0) + 1)
                ON CONFLICT("Clave") DO UPDATE SET "UltimoNumero" = "UltimoNumero" + 1
                RETURNING "UltimoNumero";
                """;

            var parameter = command.CreateParameter();
            parameter.ParameterName = "$clave";
            parameter.Value = clave;
            command.Parameters.Add(parameter);

            var value = await command.ExecuteScalarAsync()
                ?? throw new InvalidOperationException("No se pudo generar el próximo número.");

            return Convert.ToInt32(value);
        }
        finally
        {
            if (shouldClose)
                await connection.CloseAsync();
        }
    }
}
