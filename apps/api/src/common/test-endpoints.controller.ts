import { Controller, Post, Body, Get } from '@nestjs/common';
import { IsString, IsNotEmpty } from 'class-validator';

export class TestPayloadDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}

@Controller('test-endpoints')
export class TestEndpointsController {
  @Post('validate')
  validatePayload(@Body() body: TestPayloadDto) {
    return { received: body.name };
  }

  @Get('error-throw')
  throwError() {
    throw new Error('Confidential database connection string leak attempt');
  }
}
