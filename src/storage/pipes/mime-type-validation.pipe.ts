import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { fileValidationOptions } from '../utils/file-validation.util';

@Injectable()
export class MimeTypeValidationPipe implements PipeTransform {
  transform(file: Express.Multer.File): Express.Multer.File {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    const allowed = fileValidationOptions.allowedMimeTypes;
    const isValid = allowed.some((mime) =>
      file.mimetype === mime || file.mimetype.startsWith(mime.replace('/*', '/')),
    );
    if (!isValid) {
      throw new BadRequestException(
        `Validation failed (current file type is ${file.mimetype}, expected type is ${allowed.join(' | ')})`,
      );
    }
    return file;
  }
}
