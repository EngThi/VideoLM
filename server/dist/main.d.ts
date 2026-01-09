import { ExceptionFilter, ArgumentsHost } from '@nestjs/common';
export declare class GlobalErrorFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost): void;
}
