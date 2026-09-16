import { z } from "zod";
import { evaluateForm } from "./pcb";

export const savedFormSchema = z.object({
  thickness: z.string().max(40), copperK: z.string().max(40), dielectricK: z.string().max(40),
  unit: z.enum(["mil", "um", "mm", "oz"]),
  layers: z.array(z.object({ thickness: z.string().max(40), coverage: z.string().max(40) })).min(1).max(32),
});
export const calculationSchema = savedFormSchema.superRefine((form, context) => {
  const check = evaluateForm(form);
  if (check.error) context.addIssue({ code: "custom", path: ["root"], message: check.error });
});
