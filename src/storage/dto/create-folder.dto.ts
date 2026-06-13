import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateFolderDto {
  @ApiProperty({ example: 'facturas' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', required: false })
  @IsOptional()
  @IsUUID()
  parent_id?: string;
}
