import {
  BadRequestException,
  Body,
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
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { Readable } from 'node:stream';
import { ApiErrorResponseDto } from '../publics/dto/api-error-response.dto';
import { FileEntity } from './entities/file.entity';
import { FolderEntity } from './entities/folder.entity';
import { UploadFileResponseDto } from './dto/upload-file-response.dto';
import { CreateFolderDto } from './dto/create-folder.dto';
import { FolderResponseDto } from './dto/folder-response.dto';
import { StorageService } from './storage.service';
import { MimeTypeValidationPipe } from './pipes/mime-type-validation.pipe';
import { fileValidationOptions } from './utils/file-validation.util';

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
        folder_id: {
          type: 'string',
          format: 'uuid',
          description: 'ID de la carpeta (opcional)',
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
    @UploadedFile(new MimeTypeValidationPipe())
    file: Express.Multer.File,
    @Body('folder_id') folderId?: string,
  ): Promise<UploadFileResponseDto> {
    if (file.size > fileValidationOptions.maxSize) {
      throw new BadRequestException(
        `File size exceeds the maximum allowed size of ${fileValidationOptions.maxSize} bytes`,
      );
    }
    return this.storageService.uploadFile(file, folderId);
  }

  @Post('folders')
  @ApiOperation({ summary: 'Crear una carpeta' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Carpeta creada exitosamente',
    type: FolderResponseDto,
  })
  async createFolder(@Body() dto: CreateFolderDto): Promise<FolderResponseDto> {
    return this.storageService.createFolder(dto.name);
  }

  @Get('folders')
  @ApiOperation({ summary: 'Listar todas las carpetas' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Listado de carpetas',
    type: FolderEntity,
    isArray: true,
  })
  async listFolders(@Query('search') search?: string): Promise<FolderEntity[]> {
    return this.storageService.listFolders(search);
  }

  @Delete('folders/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar carpeta (solo si está vacía)' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Carpeta eliminada',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Carpeta no encontrada',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'La carpeta contiene archivos activos',
    type: ApiErrorResponseDto,
  })
  async deleteFolder(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.storageService.deleteFolder(id);
  }

  @Get('folders/:id/files')
  @ApiOperation({ summary: 'Listar archivos por carpeta' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Archivos de la carpeta',
    type: FileEntity,
    isArray: true,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Carpeta no encontrada',
    type: ApiErrorResponseDto,
  })
  async listFilesByFolder(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<FileEntity[]> {
    return this.storageService.listFilesByFolder(id);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estadísticas de almacenamiento para admin' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Estadísticas del storage',
  })
  async getStats() {
    return this.storageService.getStats();
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
