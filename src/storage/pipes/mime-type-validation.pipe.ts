import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { fileTypeFromBuffer } from 'file-type';
import { fileValidationOptions } from '../utils/file-validation.util';

@Injectable()
export class MimeTypeValidationPipe implements PipeTransform {
  async transform(file: Express.Multer.File): Promise<Express.Multer.File> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const allowed = fileValidationOptions.allowedMimeTypes;
    const isValidMime = allowed.some((mime) => file.mimetype === mime);
    if (!isValidMime) {
      throw new BadRequestException(
        `Validation failed (current file type is ${file.mimetype}, expected type is ${allowed.join(' | ')})`,
      );
    }

    if (file.mimetype !== 'application/octet-stream') {
      const detected = await fileTypeFromBuffer(file.buffer);
      if (!detected || !allowed.includes(detected.mime as any)) {
        throw new BadRequestException(
          `Validation failed (file content does not match expected types)`,
        );
      }
    }

    return file;
  }
}
