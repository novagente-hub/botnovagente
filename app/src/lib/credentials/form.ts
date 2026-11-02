import { z } from "zod";

export const credentialFormSchema = z.object({
  kind: z.enum(["model", "connector"]),
  provider: z.string().trim().min(1, "O provedor é obrigatório."),
  keyId: z.string().trim().min(1, "O ID da chave é obrigatório."),
  plaintext: z.string().min(1, "O segredo é obrigatório."),
});

export type CredentialFormValues = z.infer<typeof credentialFormSchema>;
