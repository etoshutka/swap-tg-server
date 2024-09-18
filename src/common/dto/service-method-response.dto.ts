import { HttpStatus } from "@nestjs/common";

export class ServiceMethodResponseDtoParams<D> {
  ok: boolean;
  data?: D;
  status: HttpStatus;
  message?: string;
}

/**
 * @name ServiceMethodResponseDto
 * @desc Class for service functions response
 */
export class ServiceMethodResponseDto<D> {
  public readonly ok: boolean;
  public readonly data: D;
  public readonly status: HttpStatus;
  public readonly message?: string;

  constructor(params: ServiceMethodResponseDtoParams<D>) {
    this.ok = params.ok;
    this.data = params.data;
    this.status = params.status;
    this.message = params.message;
  }
}
