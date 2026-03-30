import {
  STORAGE_ALLOWED_MIME_TYPES,
  STORAGE_MAX_FILE_SIZE_BYTES,
} from '../constants/storage.constants';

export const fileValidationOptions = {
  maxSize: STORAGE_MAX_FILE_SIZE_BYTES,
  allowedMimeTypes: [...STORAGE_ALLOWED_MIME_TYPES],
};
