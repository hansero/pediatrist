import { getFirestore } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it } from "vitest";
import { updateCalculatorConfig } from "../src/calculatorsService";
import { CALLABLES } from "../src/shared/schemas";
import { asAdmin, asMember, auditActions, callableRequest, createMember, errorOf, resetEmulators } from "./helpers";

const config = async (id: string) => (await getFirestore().doc(`calculators_config/${id}`).get()).data();

describe("updateCalculatorConfig (F7.4)", () => {
  beforeEach(async () => {
    await resetEmulators();
    await createMember("admin", "admin", "active");
    await createMember("r1", "user", "active");
  });

  it("admin protokol notunu kaydeder (kim, ne zaman), denetim kaydı düşer; boş not dokümanı siler", async () => {
    const res = await updateCalculatorConfig.run(
      callableRequest(
        { calculatorId: "calc_holliday_segar", protocolNote: "  Kurum sıvı protokolüne bakın.  " },
        asAdmin()
      )
    );
    expect(CALLABLES.updateCalculatorConfig.response.parse(res)).toEqual({ saved: true, cleared: false });
    const saved = await config("calc_holliday_segar");
    expect(saved).toMatchObject({
      calculatorId: "calc_holliday_segar",
      protocolNote: "Kurum sıvı protokolüne bakın.",
      updatedBy: "admin",
      updatedByName: "Prof. Dr. Test admin",
    });
    expect(saved?.updatedAt).toBeDefined();
    expect(await auditActions()).toContain("CALCULATOR_NOTE_UPDATED");

    const cleared = await updateCalculatorConfig.run(
      callableRequest({ calculatorId: "calc_holliday_segar", protocolNote: "   " }, asAdmin())
    );
    expect(cleared).toEqual({ saved: true, cleared: true });
    expect(await config("calc_holliday_segar")).toBeUndefined();
    expect(await auditActions()).toContain("CALCULATOR_NOTE_CLEARED");
  });

  it("hekim yazamaz; katalogda olmayan hesaplayıcı ve uzun not reddedilir", async () => {
    expect(
      (
        await errorOf(
          updateCalculatorConfig.run(
            callableRequest({ calculatorId: "calc_holliday_segar", protocolNote: "x" }, asMember("r1"))
          )
        )
      ).code
    ).toBe("permission-denied");
    const unknown = await errorOf(
      updateCalculatorConfig.run(callableRequest({ calculatorId: "calc_yok", protocolNote: "x" }, asAdmin()))
    );
    expect(unknown).toMatchObject({ code: "invalid-argument" });
    expect(unknown.message).toContain("Hesaplayıcı bulunamadı.");
    const long = await errorOf(
      updateCalculatorConfig.run(
        callableRequest({ calculatorId: "calc_holliday_segar", protocolNote: "a".repeat(2001) }, asAdmin())
      )
    );
    expect(long).toMatchObject({ code: "invalid-argument" });
    expect(await config("calc_holliday_segar")).toBeUndefined();
    expect(await auditActions()).not.toContain("CALCULATOR_NOTE_UPDATED");
  });
});
