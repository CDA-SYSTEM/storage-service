import { ApiProperty } from '@nestjs/swagger';

export class FolderEntity {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: 'facturas' })
  name!: string;

  @ApiProperty({ example: '2026-03-30T12:00:00.000Z' })
  created_at!: Date;

  @ApiProperty({ example: null, required: false })
  parent_id?: string | null;
}
