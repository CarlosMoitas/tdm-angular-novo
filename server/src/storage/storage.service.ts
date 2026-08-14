import fs from 'fs';
import path from 'path';

/**
 * Persistência local de artefatos gerados nas execuções contra o TDM.
 *
 * IMPORTANTE — o artefato .zip retornado pelo TDM NÃO é gravado em disco
 * neste servidor. Ele é baixado do TDM inteiramente em memória (Buffer),
 * e a extração da conta corrente criada (ver `artifact-extractor.ts`) é
 * feita diretamente sobre esse Buffer, sem qualquer escrita em arquivo.
 * Essa decisão é intencional: quando este servidor for hospedado dentro
 * do BEX (via shell/iframe), não haverá espaço em disco disponível/
 * permitido para gravação de arquivos — logo, nenhuma rotina deste
 * projeto deve depender de persistência local do artefato.
 *
 * Estrutura em disco (fora de src/, não versionada no git — ver .gitignore):
 *
 *   server/storage/
 *   └── payloads/
 *       └── <jobId>.json    → payload exato enviado na submissão do job
 *                              (mantido apenas para auditoria/depuração do
 *                              payload enviado; NÃO contém o artefato ZIP)
 */
const STORAGE_ROOT = path.join(__dirname, '..', '..', 'storage');
const PAYLOADS_DIR = path.join(STORAGE_ROOT, 'payloads');

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

/** Salva o payload exato enviado ao TDM, indexado pelo jobId retornado na submissão. */
export function savePayload(jobId: number, payload: unknown): string {
  ensureDir(PAYLOADS_DIR);
  const filePath = path.join(PAYLOADS_DIR, `${jobId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
  return filePath;
}

export const storagePaths = {
  root: STORAGE_ROOT,
  payloadsDir: PAYLOADS_DIR,
};
