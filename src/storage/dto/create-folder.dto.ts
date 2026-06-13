import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateFolderDto {
  @ApiProperty({ example: 'facturas' })
  @IsString()
  @IsNotEmpty()
  name!: string;
}
