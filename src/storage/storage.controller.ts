import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ParseFilePipeBuilder } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { Readable } from 'node:stream';
import { ApiErrorResponseDto } from '../publics/dto/api-error-response.dto';
import { FileEntity } from './entities/file.entity';
import { UploadFileResponseDto } from './dto/upload-file-response.dto';
import { fileValidationOptions } from './utils/file-validation.util';
import { StorageService } from './storage.service';

@ApiTags('storage')
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload de archivo y persistencia en Cassandra' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Archivo subido exitosamente',
    type: UploadFileResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Archivo invalido',
    type: ApiErrorResponseDto,
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
    }),
  )
  async upload(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: new RegExp(fileValidationOptions.allowedMimeTypes.join('|')),
        })
        .addMaxSizeValidator({ maxSize: fileValidationOptions.maxSize })
        .build({
          fileIsRequired: true,
          errorHttpStatusCode: HttpStatus.BAD_REQUEST,
        }),
    )
    file: Express.Multer.File,
  ): Promise<UploadFileResponseDto> {
    return this.storageService.uploadFile(file);
  }

  @Get('files')
  @ApiOperation({ summary: 'Listar archivos activos (no eliminados)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Listado de archivos',
    type: FileEntity,
    isArray: true,
  })
  async listFiles(@Query('limit') limit?: string): Promise<FileEntity[]> {
    const parsedLimit = limit ? Number(limit) : undefined;
    return this.storageService.listFiles(parsedLimit);
  }

  @Get('files/:id')
  @ApiOperation({ summary: 'Recuperar stream de archivo por ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Stream de archivo',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Archivo no encontrado',
    type: ApiErrorResponseDto,
  })
  async getFile(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.storageService.getFileById(id);
    res.setHeader('Content-Type', file.mimetype);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(file.original_name)}"`,
    );
    Readable.from(file.file_data).pipe(res);
  }

  @Delete('files/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete de archivo (actualiza deleted_at)' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Archivo eliminado logicamente',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Archivo no encontrado',
    type: ApiErrorResponseDto,
  })
  async remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.storageService.softDelete(id);
  }
}
