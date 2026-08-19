import { TodoEntity } from '@/modules/todos/entities/todo.entity';
import { TodoResponseDto } from '@/modules/todos/dto/todo-response.dto';

/**
 * Ánh xạ todo entity sang DTO công khai, không kèm quan hệ nội bộ.
 *
 * @param todo Entity todo từ database.
 * @returns Todo đúng hợp đồng API.
 */
export function toPublicTodo(todo: TodoEntity): TodoResponseDto {
  return {
    id: todo.id,
    title: todo.title,
    description: todo.description,
    isDone: todo.isDone,
    ownerId: todo.ownerId,
    createdAt: todo.createdAt,
    updatedAt: todo.updatedAt,
  };
}
