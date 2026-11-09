import { Controller, Get, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types/auth-user';
import { SearchService } from './search.service';

class SearchQueryDto {
  @IsString()
  @MaxLength(200)
  q: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  projectId?: number;
}

@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  find(@CurrentUser() user: AuthUser, @Query() query: SearchQueryDto) {
    return this.search.search(user, query.q, query.projectId);
  }
}
