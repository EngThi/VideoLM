import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,
  ) {}

  async findByEmail(email: string): Promise<UserEntity | undefined> {
    return this.userRepo.findOne({ 
      where: { email },
      select: ['id', 'email', 'password', 'quota', 'videosGenerated'] 
    });
  }

  async create(email: string, passwordHash: string): Promise<UserEntity> {
    const user = this.userRepo.create({
      email,
      password: passwordHash,
    });
    return this.userRepo.save(user);
  }

  async updateQuota(id: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (user) {
      user.videosGenerated += 1;
      await this.userRepo.save(user);
    }
  }
}
