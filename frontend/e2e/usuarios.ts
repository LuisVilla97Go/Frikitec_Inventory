import { expect, test } from "@playwright/test";

test("el administrador desactiva desde Editar, reactiva y elimina con la papelera", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/usuarios");
    await page
        .getByRole("button", { name: "Nuevo usuario", exact: true })
        .click();
    const alta = page.getByRole("dialog", { name: "Nuevo usuario", exact: true });
    await alta.getByLabel("Nombres *", { exact: true }).fill("Baja E2E");
    await alta.getByLabel("Apellidos *", { exact: true }).fill("Usuarios");
    await alta
        .getByLabel("Usuario o email *", { exact: true })
        .fill("baja-acciones@e2e.test");
    await alta
        .getByLabel("Contraseña", { exact: false })
        .fill("clave-e2e-solo-pruebas");
    await alta.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(alta).toBeHidden();
    const fila = page
        .getByRole("row")
        .filter({ hasText: "baja-acciones@e2e.test" });
    await expect(fila).toContainText("Activo");
    await fila.getByRole("button", { name: "Editar", exact: true }).click();
    const editar = page.getByRole("dialog", {
        name: "Editar usuario",
        exact: true,
    });
    const interruptor = editar.getByRole("switch", { name: /Usuario activo/ });
    await expect(interruptor).toBeChecked();
    await interruptor.uncheck();
    await editar.getByRole("button", { name: "Guardar", exact: true }).click();
    const baja = page.getByRole("dialog", {
        name: "¿Desactivar usuario?",
        exact: true,
    });
    await expect(baja).toContainText("seguirá en el listado y podrá reactivarse");
    const cancelar = baja.getByRole("button", { name: "Cancelar", exact: true });
    await expect(cancelar).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
        baja.getByRole("button", { name: "Guardar y desactivar", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(cancelar).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(
        baja.getByRole("button", { name: "Guardar y desactivar", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(baja).toBeHidden();
    await expect(fila).toContainText("Activo");
    await expect(editar).toBeVisible();
    await expect(
        editar.getByRole("button", { name: "Guardar", exact: true }),
    ).toBeFocused();
    await editar.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(
        baja.getByRole("button", { name: "Guardar y desactivar", exact: true }),
    ).toHaveCSS("background-color", "rgb(225, 29, 72)");
    await page.screenshot({
        path: "test-results/cierre-visual/usuarios-baja-1366.png",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(baja).toBeVisible();
    await page.screenshot({
        path: "test-results/cierre-visual/usuarios-baja-390.png",
    });
    await page.setViewportSize({ width: 1366, height: 768 });
    await baja
        .getByRole("button", { name: "Guardar y desactivar", exact: true })
        .click();
    await expect(baja).toBeHidden();
    await expect(editar).toBeHidden();
    await expect(
        fila.getByRole("button", { name: "Editar", exact: true }),
    ).toBeFocused();
    await expect(fila).toContainText("Inactivo");
    await page.reload();
    await expect(fila).toContainText("Inactivo");
    await fila.getByRole("button", { name: "Editar", exact: true }).click();
    await expect(interruptor).not.toBeChecked();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
        path: "test-results/cierre-visual/usuarios-editar-390.png",
    });
    await interruptor.check();
    await editar.getByRole("button", { name: "Guardar", exact: true }).click();
    const reactivar = page.getByRole("dialog", {
        name: "¿Reactivar usuario?",
        exact: true,
    });
    await expect(reactivar).toBeVisible();
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.screenshot({
        path: "test-results/cierre-visual/usuarios-reactivar-1366.png",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
        path: "test-results/cierre-visual/usuarios-reactivar-390.png",
    });
    await page.setViewportSize({ width: 1366, height: 768 });
    await reactivar
        .getByRole("button", { name: "Guardar y reactivar", exact: true })
        .click();
    await expect(reactivar).toBeHidden();
    await expect(
        fila.getByRole("button", { name: "Editar", exact: true }),
    ).toBeFocused();
    await expect(fila).toContainText("Activo");
    await expect(
        fila.getByRole("button", { name: "Eliminar", exact: true }),
    ).toBeVisible();
    await fila.getByRole("button", { name: "Eliminar", exact: true }).click();
    const eliminar = page.getByRole("dialog", {
        name: "¿Eliminar usuario?",
        exact: true,
    });
    await expect(eliminar).toContainText(
        "Su autoría en el historial se conserva",
    );
    await expect(eliminar).toContainText("no podrá reactivarse");
    await page.keyboard.press("Escape");
    await expect(eliminar).toBeHidden();
    await expect(
        fila.getByRole("button", { name: "Eliminar", exact: true }),
    ).toBeFocused();
    await fila.getByRole("button", { name: "Eliminar", exact: true }).click();
    await eliminar.getByRole("button", { name: "Eliminar", exact: true }).click();
    await expect(fila).toHaveCount(0);
    await page.reload();
    await expect(fila).toHaveCount(0);
});
