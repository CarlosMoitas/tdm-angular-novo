#!/usr/bin/env python3
"""
Rotina de teste 100% independente para executar, em sequência, os 3 cards do
workflow "Abertura de Contas" falando DIRETAMENTE com o Broadcom TDM.

IMPORTANTE
- Este script NÃO altera o projeto existente.
- Ele NÃO depende do frontend nem do backend local.
- Ele integra diretamente com o TDM usando:
  - TDM base URL
  - usuário/senha OU bearer token
- Ele também baixa/processa o artefato ZIP localmente para extrair
  Agência/Nova Conta e alimentar os cards seguintes.

Fluxo executado:
1. Autenticação direta no TDM
2. Submit card 1: Contas Correntes - PF
3. Polling até conclusão
4. Download do artifact ZIP
5. Extração de Agência/Nova Conta
6. Submit card 2: Habilitar Conta MA
7. Polling até conclusão
8. Submit card 3: Débito Automático
9. Polling até conclusão
10. Resumo final

Pré-requisitos:
- Python 3.10+
- requests instalado: pip install requests
"""

from __future__ import annotations

import io
import json
import sys
import time
import uuid
import zipfile
from dataclasses import dataclass
from datetime import datetime
from getpass import getpass
from typing import Any, Dict, Optional

import requests


TARGET_LOG_SUFFIX = "Action_38_1_Workflow.log"
TOKEN_TTL_SECONDS = 10 * 60
DEFAULT_ENVIRONMENT = "TU"
DEFAULT_AGENCY = "3995"

WORKFLOW_EMAIL = "carlos.andremoitas@emeal.nttdata.com"
WORKFLOW_PROJETO_JIRA = "CPTDM-CORPORATIVO | TDM"
WORKFLOW_USERNAME_FALLBACK = "m627529"


@dataclass
class TdmConfig:
    base_url: str
    origin: str
    referer: str
    username: str
    password: str
    bearer_token: str
    verify_ssl: bool = False


@dataclass
class WorkflowContext:
    tdm_username: str
    environment: str
    agency: str
    conta: Optional[str] = None
    projeto_jira: str = WORKFLOW_PROJETO_JIRA


class TdmClient:
    def __init__(self, config: TdmConfig) -> None:
        self.config = config
        self.session = requests.Session()
        self.cached_token: Optional[str] = config.bearer_token or None
        self.cached_token_at = 0.0 if not self.cached_token else time.time()

    def _headers(self, token: Optional[str] = None, extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        headers = {
            "Accept": "application/json",
            "x-correlation-id": str(uuid.uuid4()),
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"
        if extra:
            headers.update(extra)
        return headers

    def login(self, force: bool = False) -> str:
        now = time.time()

        if not force and self.cached_token and (now - self.cached_token_at) < TOKEN_TTL_SECONDS:
            return self.cached_token

        if not self.config.base_url:
            raise RuntimeError("TDM base URL não informada.")

        if self.config.bearer_token and not force:
            self.cached_token = self.config.bearer_token
            self.cached_token_at = now
            return self.cached_token

        if not self.config.username or not self.config.password:
            raise RuntimeError("Informe usuário/senha do TDM ou bearer token.")

        url = f"{self.config.base_url}/TestDataManager/user/login"
        response = self.session.post(
            url,
            headers={"Accept": "application/json"},
            auth=(self.config.username, self.config.password),
            verify=self.config.verify_ssl,
            timeout=60,
        )

        if response.status_code in (401, 403):
            raise RuntimeError("Usuário ou senha do TDM inválidos.")

        if response.status_code < 200 or response.status_code >= 300:
            raise RuntimeError(f"Falha no login do TDM (status {response.status_code}): {response.text}")

        data = response.json()
        token = data.get("token")
        if not token:
            raise RuntimeError("Login do TDM não retornou token.")

        self.cached_token = token
        self.cached_token_at = now
        return token

    def request(self, method: str, url: str, **kwargs: Any) -> requests.Response:
        token = self.login()
        headers = kwargs.pop("headers", {})
        merged_headers = self._headers(token, headers)

        response = self.session.request(
            method=method,
            url=url,
            headers=merged_headers,
            verify=self.config.verify_ssl,
            timeout=kwargs.pop("timeout", 120),
            **kwargs,
        )

        if response.status_code in (401, 403):
            token = self.login(force=True)
            merged_headers = self._headers(token, headers)
            response = self.session.request(
                method=method,
                url=url,
                headers=merged_headers,
                verify=self.config.verify_ssl,
                timeout=kwargs.pop("timeout", 120),
                **kwargs,
            )

        return response


def now_iso() -> str:
    return datetime.utcnow().isoformat(timespec="milliseconds") + "Z"


def now_epoch_millis() -> int:
    return int(time.time() * 1000)


def print_json(title: str, data: Dict[str, Any]) -> None:
    print(f"\n===== {title} =====")
    print(json.dumps(data, indent=2, ensure_ascii=False))


def normalize_status(status: Optional[str]) -> str:
    return str(status or "").strip().lower()


def is_completed(status: Optional[str]) -> bool:
    return normalize_status(status) == "completed"


def read_required(prompt: str, default: Optional[str] = None, secret: bool = False) -> str:
    suffix = f" [{default}]" if default else ""
    if secret:
        value = getpass(f"{prompt}{suffix}: ").strip()
    else:
        value = input(f"{prompt}{suffix}: ").strip()

    if value:
        return value
    if default is not None:
        return default
    raise ValueError(f"Valor obrigatório não informado: {prompt}")


def extract_job_id(response_data: Dict[str, Any]) -> Optional[int]:
    job_id = response_data.get("jobId")
    if job_id is None:
        job_id = response_data.get("id")
    if job_id is None and isinstance(response_data.get("data"), dict):
        nested = response_data["data"]
        job_id = nested.get("jobId") or nested.get("id")
    return int(job_id) if job_id is not None else None


def pick_downloadable_child_job(job: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    children = job.get("jobs") if isinstance(job.get("jobs"), list) else []

    for child in children:
        if str(child.get("type", "")).upper() == "PUBLISH" and is_completed(child.get("status")) and child.get("artifactLocation"):
            return child

    for child in children:
        if str(child.get("type", "")).upper() == "PUBLISH" and is_completed(child.get("status")):
            return child

    for child in children:
        if is_completed(child.get("status")) and child.get("artifactLocation"):
            return child

    for child in children:
        if is_completed(child.get("status")):
            return child

    return None


def get_contas_correntes_env_config(environment: str) -> Dict[str, Any]:
    configs = {
        "TU": {
            "ambienteLabel": "PDB204P - TU",
            "segmentoContaCorretePF": "000-CLIENTE CLASSIC",
            "configurationId": 2982,
        },
        "TI": {
            "ambienteLabel": "PCM2AB  - NOVO TI",
            "segmentoContaCorretePF": "",
            "configurationId": 2985,
        },
    }
    return configs[environment]


def get_habilitar_ma_env_config(environment: str) -> Dict[str, Any]:
    configs = {
        "TU": {
            "levelID": 4588,
            "configurationId": 3019,
            "vtfnodeID": "420",
            "vtfnodeName": "Habilitar Conta MA TU",
        },
        "TI": {
            "levelID": 4593,
            "configurationId": 3032,
            "vtfnodeID": "540",
            "vtfnodeName": "Habilitar MA NOVO TI",
        },
    }
    return configs[environment]


def get_debito_automatico_env_config(environment: str) -> Dict[str, Any]:
    configs = {
        "TU": {"configurationId": 845},
        "TI": {"configurationId": 845},
    }
    return configs[environment]


def build_card_1_payload(context: WorkflowContext) -> Dict[str, Any]:
    current_iso = now_iso()
    current_millis = now_epoch_millis()
    env = get_contas_correntes_env_config(context.environment)
    dt = datetime.now()

    return {
        "jobPubParams": {
            "scheduledDateTimeInMillisec": current_iso,
            "almjobs": [],
            "rallyJobs": [],
            "jobParams": [],
            "publishJobs": [
                {
                    "batchEngineThread": "ANY",
                    "dataSourceProfile": "DB204P",
                    "dataTargetProfile": "DB204P",
                    "description": "",
                    "jobTitle": "Group Job",
                    "levelID": 3309,
                    "publishVariables": [
                        {"name": "p_ambiente_gerar_conta", "preResolveError": "", "preResolveValue": "", "value": env["ambienteLabel"]},
                        {"name": "p_SegmentoContaCorretePF", "preResolveError": "", "preResolveValue": "", "value": env["segmentoContaCorretePF"]},
                        {"name": "p_agencia", "preResolveError": "", "preResolveValue": "", "value": context.agency or DEFAULT_AGENCY},
                        {"name": "p_cpf", "preResolveError": "", "preResolveValue": "", "value": "0"},
                        {"name": "p_qtdcontas_ger", "preResolveError": "", "preResolveValue": "", "value": "1"},
                        {"name": "p_projeto_jira", "preResolveError": "", "preResolveValue": "", "value": context.projeto_jira},
                        {"name": "p_tp_disp", "preResolveError": "", "preResolveValue": "", "value": "SEM DISPOSITIVO"},
                    ],
                    "seq": 1,
                    "vtfnodeDesc": "02 - Conta Corrente PF",
                    "vtfnodeID": "11020",
                    "vtfnodeName": "02 - Conta Corrente PF",
                    "iterations": 1,
                    "csvDelimiter": None,
                    "csvQuotationMarks": None,
                    "configurationId": env["configurationId"],
                }
            ],
            "testMatches": [],
            "exportJobs": [],
            "scheduledDt": current_iso,
            "selfServiceEmailMandate": False,
            "email": WORKFLOW_EMAIL,
            "globalThreadName": "ANY",
            "scheduledDateTimeInMillis": current_millis,
            "currentDay": dt.day,
            "currentMonth": dt.month,
            "currentYear": dt.year,
            "globalSourceConnection": "DB204P",
            "globalTargetConnection": "DB204P",
            "jobSubmissionOrder": "0",
            "jobTitle": "Contas Correntes - PF Data Request",
            "username": context.tdm_username or WORKFLOW_USERNAME_FALLBACK,
        },
        "dataDesign": {"projectID": 2476, "versionID": 2477},
        "advancedToggleFlag": True,
    }


def build_card_2_payload(context: WorkflowContext) -> Dict[str, Any]:
    current_iso = now_iso()
    current_millis = now_epoch_millis()
    env = get_habilitar_ma_env_config(context.environment)
    dt = datetime.now()

    return {
        "jobPubParams": {
            "scheduledDateTimeInMillisec": current_iso,
            "almjobs": [],
            "rallyJobs": [],
            "jobParams": [],
            "publishJobs": [
                {
                    "batchEngineThread": "ANY",
                    "dataSourceProfile": "",
                    "dataTargetProfile": "",
                    "description": "",
                    "jobTitle": "Group Job",
                    "levelID": env["levelID"],
                    "publishVariables": [
                        {"name": "P_AGENCIA_MA", "preResolveError": "", "preResolveValue": "", "value": context.agency},
                        {"name": "P_CONTA_MA", "preResolveError": "", "preResolveValue": "", "value": context.conta},
                        {"name": "p_projeto_jira", "preResolveError": "", "preResolveValue": "", "value": context.projeto_jira},
                    ],
                    "seq": 1,
                    "vtfnodeDesc": env["vtfnodeName"],
                    "vtfnodeID": env["vtfnodeID"],
                    "vtfnodeName": env["vtfnodeName"],
                    "iterations": 1,
                    "csvDelimiter": None,
                    "csvQuotationMarks": None,
                    "configurationId": env["configurationId"],
                }
            ],
            "testMatches": [],
            "exportJobs": [],
            "scheduledDt": current_iso,
            "selfServiceEmailMandate": False,
            "email": WORKFLOW_EMAIL,
            "globalThreadName": "ANY",
            "scheduledDateTimeInMillis": current_millis,
            "currentDay": dt.day,
            "currentMonth": dt.month,
            "currentYear": dt.year,
            "globalSourceConnection": "DB204P",
            "globalTargetConnection": "",
            "jobSubmissionOrder": "0",
            "jobTitle": "Habilitar Conta MA Data Request",
            "username": context.tdm_username or WORKFLOW_USERNAME_FALLBACK,
        },
        "dataDesign": {"projectID": 3862, "versionID": 3863},
        "advancedToggleFlag": True,
    }


def build_card_3_payload(context: WorkflowContext) -> Dict[str, Any]:
    current_iso = now_iso()
    current_millis = now_epoch_millis()
    env = get_debito_automatico_env_config(context.environment)
    dt = datetime.now()

    return {
        "jobPubParams": {
            "scheduledDateTimeInMillisec": current_iso,
            "almjobs": [],
            "rallyJobs": [],
            "jobParams": [],
            "publishJobs": [
                {
                    "batchEngineThread": "ANY",
                    "dataSourceProfile": "DB204P",
                    "dataTargetProfile": "",
                    "description": "",
                    "jobTitle": "Group Job",
                    "levelID": 3101,
                    "publishVariables": [
                        {"name": "p_combo_ctpo_crtl_db_uf", "preResolveError": "", "preResolveValue": "", "value": "01-SP                                      "},
                        {"name": "p_combo_ctpo_crtl_db", "preResolveError": "", "preResolveValue": "", "value": "001-Energia Elétrica                   "},
                        {"name": "p_combo_empresa", "preResolveError": "", "preResolveValue": "", "value": "2269651-0000000906-CETRIL/SP                                - 01237               "},
                        {"name": "p_agencia", "preResolveError": "", "preResolveValue": "", "value": context.agency},
                        {"name": "p_conta", "preResolveError": "", "preResolveValue": "", "value": context.conta},
                        {"name": "p_combo_contratante", "preResolveError": "", "preResolveValue": "", "value": "999-NOVO CONTRATO"},
                        {"name": "p_qntd", "preResolveError": "", "preResolveValue": "", "value": "1"},
                        {"name": "p_projeto_jira", "preResolveError": "", "preResolveValue": "", "value": context.projeto_jira},
                    ],
                    "seq": 1,
                    "vtfnodeDesc": "Débito Automático Corrente Mobile e TF",
                    "vtfnodeID": "53470",
                    "vtfnodeName": "Débito Automático Corrente Mobile e TF",
                    "iterations": 1,
                    "csvDelimiter": None,
                    "csvQuotationMarks": None,
                    "configurationId": env["configurationId"],
                }
            ],
            "testMatches": [],
            "exportJobs": [],
            "scheduledDt": current_iso,
            "selfServiceEmailMandate": False,
            "email": WORKFLOW_EMAIL,
            "globalThreadName": "ANY",
            "scheduledDateTimeInMillis": current_millis,
            "currentDay": dt.day,
            "currentMonth": dt.month,
            "currentYear": dt.year,
            "globalSourceConnection": "DB204P",
            "globalTargetConnection": "DB204P",
            "jobSubmissionOrder": "0",
            "jobTitle": "Débito Automático Data Request",
            "username": context.tdm_username or WORKFLOW_USERNAME_FALLBACK,
        },
        "dataDesign": {"projectID": 2346, "versionID": 2351},
        "advancedToggleFlag": True,
    }


def fetch_job_details(client: TdmClient, job_id: int) -> Dict[str, Any]:
    url = f"{client.config.base_url}/TDMJobService/api/ca/v1/jobs/{job_id}"
    response = client.request("GET", url, timeout=60)

    if response.status_code < 200 or response.status_code >= 300:
        raise RuntimeError(f"TDM retornou erro ao consultar o job {job_id}: {response.status_code} {response.text}")

    return response.json()


def wait_for_job_completion(
    client: TdmClient,
    job_id: int,
    max_attempts: int = 24,
    delay_seconds: int = 5,
) -> Dict[str, Any]:
    last_parent_job: Optional[Dict[str, Any]] = None
    last_error: Optional[Exception] = None

    for attempt in range(1, max_attempts + 1):
        try:
            parent_job = fetch_job_details(client, job_id)
            last_parent_job = parent_job
            child_job = pick_downloadable_child_job(parent_job)

            if is_completed(parent_job.get("status")) and (not child_job or is_completed(child_job.get("status"))):
                return {"parentJob": parent_job, "childJob": child_job}

            if normalize_status(parent_job.get("status")) in {"failed", "cancelled", "canceled"}:
                raise RuntimeError(f"O job {job_id} terminou com status {parent_job.get('status')}.")

            print(f"Tentativa {attempt}/{max_attempts}: job {job_id} ainda em status {parent_job.get('status')}")

        except Exception as exc:
            last_error = exc
            print(f"Falha transitória ao consultar job {job_id} na tentativa {attempt}/{max_attempts}: {exc}")

        if attempt < max_attempts:
            time.sleep(delay_seconds)

    if last_error:
        raise last_error

    raise RuntimeError(f"Timeout aguardando a conclusão do job {job_id}. Último estado: {last_parent_job}")


def download_artifact(client: TdmClient, job_id: int) -> bytes:
    url = f"{client.config.base_url}/TDMJobService/api/ca/v1/jobs/{job_id}/actions/downloadArtifact"
    response = client.request(
        "POST",
        url,
        headers={"Accept": "application/octet-stream, application/zip, */*"},
        timeout=120,
    )

    if response.status_code < 200 or response.status_code >= 300:
        raise RuntimeError(f"TDM retornou erro ao baixar o artefato do job {job_id}: {response.status_code} {response.text}")

    return response.content


def extract_account_info_from_zip(zip_bytes: bytes) -> Dict[str, Any]:
    try:
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zip_file:
            target_name = next(
                (name for name in zip_file.namelist() if name.endswith(TARGET_LOG_SUFFIX)),
                None,
            )

            if not target_name:
                return {"found": False, "reason": f"Arquivo {TARGET_LOG_SUFFIX} não encontrado dentro do ZIP."}

            raw = zip_file.read(target_name).decode("utf-8", errors="ignore")
            lines = raw.splitlines()

            response_line = None
            for line in reversed(lines):
                if "response.Content:" in line and "Agencia" in line and "Nova Conta" in line:
                    response_line = line
                    break

            if not response_line:
                return {"found": False, "reason": "Nenhuma linha com Agencia e Nova Conta foi encontrada no log."}

            import re

            agencia_match = re.search(r'"Agencia":"(\d+)"', response_line)
            conta_match = re.search(r'"Nova Conta":"(\d+)"', response_line)

            return {
                "found": bool(agencia_match and conta_match),
                "agencia": agencia_match.group(1) if agencia_match else None,
                "conta": conta_match.group(1) if conta_match else None,
            }
    except zipfile.BadZipFile as exc:
        return {"found": False, "reason": f"ZIP inválido: {exc}"}


def submit_request(client: TdmClient, payload: Dict[str, Any]) -> Dict[str, Any]:
    url = f"{client.config.base_url}/TDMDataFlowService/api/ca/v1/requests"
    response = client.request(
        "POST",
        url,
        json=payload,
        headers={
            "Content-Type": "application/json",
            "Origin": client.config.origin,
            "Referer": client.config.referer,
            "X-Requested-With": "tdm-python-workflow-test",
        },
        timeout=180,
    )

    if response.status_code < 200 or response.status_code >= 300:
        raise RuntimeError(f"TDM retornou erro ao executar o request: {response.status_code} {response.text}")

    data = response.json()
    requested_job_id = extract_job_id(data)
    if not requested_job_id:
        raise RuntimeError(f"TDM não retornou jobId após submissão: {json.dumps(data, ensure_ascii=False)}")

    wait_result = wait_for_job_completion(client, requested_job_id)
    parent_job = wait_result["parentJob"]
    child_job = wait_result["childJob"]
    effective_job_id = int(child_job["jobId"]) if child_job and child_job.get("jobId") else requested_job_id

    artifact_bytes = download_artifact(client, effective_job_id)
    extracted = extract_account_info_from_zip(artifact_bytes)

    return {
        "success": True,
        "requestedJobId": requested_job_id,
        "childJobId": int(child_job["jobId"]) if child_job and child_job.get("jobId") else None,
        "effectiveJobId": effective_job_id,
        "parentStatus": parent_job.get("status"),
        "childStatus": child_job.get("status") if child_job else None,
        "sizeBytes": len(artifact_bytes),
        "extractedContaInfo": extracted,
    }


def main() -> int:
    print("Teste independente do workflow TDM com 3 cards em sequência\n")

    base_url = read_required("TDM base URL (ex.: https://host-do-tdm)")
    origin = read_required("TDM Origin", base_url)
    referer = read_required("TDM Referer", f"{origin}/")

    use_token = read_required("Usar bearer token direto? (s/n)", "n").lower() == "s"

    bearer_token = ""
    username = ""
    password = ""

    if use_token:
        bearer_token = read_required("Bearer token", secret=True)
        username = read_required("Username técnico do TDM (para preencher payload)", WORKFLOW_USERNAME_FALLBACK)
    else:
        username = read_required("Usuário do TDM")
        password = read_required("Senha do TDM", secret=True)

    environment = read_required("Ambiente (TU/TI)", DEFAULT_ENVIRONMENT).upper()
    agency = read_required("Agência", DEFAULT_AGENCY)
    projeto_jira = read_required("Projeto Jira", WORKFLOW_PROJETO_JIRA)

    if environment not in {"TU", "TI"}:
        print("Ambiente inválido. Use TU ou TI.")
        return 1

    config = TdmConfig(
        base_url=base_url.rstrip("/"),
        origin=origin,
        referer=referer,
        username=username,
        password=password,
        bearer_token=bearer_token,
        verify_ssl=False,
    )

    context = WorkflowContext(
        tdm_username=username,
        environment=environment,
        agency=agency,
        projeto_jira=projeto_jira,
    )

    client = TdmClient(config)

    try:
        print("\n[1/6] Autenticando no TDM...")
        token = client.login()
        print(f"Autenticação OK. Token obtido: {'SIM' if token else 'NÃO'}")

        print("\n[2/6] Submetendo Card 1 - Contas Correntes - PF...")
        payload1 = build_card_1_payload(context)
        print_json("PAYLOAD CARD 1", payload1)
        result1 = submit_request(client, payload1)
        print_json("RESPOSTA CARD 1", result1)

        extracted = result1.get("extractedContaInfo") or {}
        conta = extracted.get("conta")
        agencia_extraida = extracted.get("agencia")

        if not conta:
            print("\nNão foi possível obter a conta extraída do card 1.")
            print(f"Motivo: {extracted.get('reason')}")
            return 2

        context.conta = conta
        if agencia_extraida:
            context.agency = agencia_extraida

        print(f"\nConta extraída do card 1: {context.conta}")
        print(f"Agência usada na sequência: {context.agency}")

        print("\n[3/6] Submetendo Card 2 - Habilitar Conta MA...")
        payload2 = build_card_2_payload(context)
        print_json("PAYLOAD CARD 2", payload2)
        result2 = submit_request(client, payload2)
        print_json("RESPOSTA CARD 2", result2)

        print("\n[4/6] Submetendo Card 3 - Débito Automático...")
        payload3 = build_card_3_payload(context)
        print_json("PAYLOAD CARD 3", payload3)
        result3 = submit_request(client, payload3)
        print_json("RESPOSTA CARD 3", result3)

        print("\n[5/6] Resumo final")
        resumo = {
            "baseUrl": config.base_url,
            "environment": context.environment,
            "agencia": context.agency,
            "conta": context.conta,
            "projetoJira": context.projeto_jira,
            "card1": {
                "requestedJobId": result1.get("requestedJobId"),
                "childJobId": result1.get("childJobId"),
                "effectiveJobId": result1.get("effectiveJobId"),
                "parentStatus": result1.get("parentStatus"),
                "childStatus": result1.get("childStatus"),
            },
            "card2": {
                "requestedJobId": result2.get("requestedJobId"),
                "childJobId": result2.get("childJobId"),
                "effectiveJobId": result2.get("effectiveJobId"),
                "parentStatus": result2.get("parentStatus"),
                "childStatus": result2.get("childStatus"),
            },
            "card3": {
                "requestedJobId": result3.get("requestedJobId"),
                "childJobId": result3.get("childJobId"),
                "effectiveJobId": result3.get("effectiveJobId"),
                "parentStatus": result3.get("parentStatus"),
                "childStatus": result3.get("childStatus"),
            },
        }
        print_json("RESUMO", resumo)

        print("\n[6/6] Execução concluída.")
        return 0

    except requests.HTTPError as exc:
        print(f"\nErro HTTP: {exc}")
        return 3
    except Exception as exc:
        print(f"\nErro: {exc}")
        return 4


if __name__ == "__main__":
    sys.exit(main())
