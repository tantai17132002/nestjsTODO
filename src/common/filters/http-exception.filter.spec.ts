import { ArgumentsHost, BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';

/**
 * Unit test cho global exception filter và hợp đồng lỗi.
 */
describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let json: jest.Mock;
  let status: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({
          method: 'POST',
          url: '/todos',
          body: { title: '', password: 'secret' },
          headers: { 'x-request-id': 'req-1' },
          get: () => 'jest',
          ip: '127.0.0.1',
        }),
      }),
    } as unknown as ArgumentsHost;
  });

  it('should keep validation details from BadRequestException', () => {
    const exception = new BadRequestException({
      message: 'Validation failed',
      error: 'Bad Request',
      details: [{ field: 'title', message: 'title should not be empty' }],
    });

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: 'Validation failed',
        error: 'Bad Request',
        path: '/todos',
        requestId: 'req-1',
        details: [{ field: 'title', message: 'title should not be empty' }],
      }),
    );
  });

  it('should map unique violation to 409', () => {
    const exception = new QueryFailedError('INSERT', [], new Error('duplicate'));
    (exception as QueryFailedError & { code: string }).code = '23505';

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        message: 'Resource already exists',
      }),
    );
  });

  it('should map not found exception to 404', () => {
    filter.catch(new NotFoundException('Todo not found'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        message: 'Todo not found',
      }),
    );
  });
});
