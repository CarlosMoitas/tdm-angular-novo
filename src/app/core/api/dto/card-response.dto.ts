export interface CardEnvironmentDto {
  label: string;
  value: string;
}

export interface CardResponseDto {
  id: string;
  title: string;
  project: string;
  catalogId: string;
  environments?: CardEnvironmentDto[];
  requiresAgencyInput?: boolean;
}
