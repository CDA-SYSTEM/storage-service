import { ApiProperty } from '@nestjs/swagger';

export class FileEntity {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: 'fdd8b68d-a9f8-4c3d-95ea-file.pdf' })
  filename!: string;

  @ApiProperty({ example: 'report.pdf' })
  original_name!: string;

  @ApiProperty({ example: 'application/pdf' })
  mimetype!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', nullable: true, required: false })
  folder_id?: string | null;

  @ApiProperty({ example: '2026-03-30T12:00:00.000Z' })
  created_at!: Date;

  @ApiProperty({
    example: null,
    nullable: true,
    required: false,
  })
  deleted_at!: Date | null;
}
