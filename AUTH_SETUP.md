# 真实认证系统设置指南

本指南将帮助您启用 UITrace 的真实登录系统和数据库认证，而不是使用模拟数据。

## 🚀 快速开始

### 1. 后端设置

#### 安装依赖
```bash
cd backend
npm install
```

#### 配置环境变量
复制 `.env.example` 到 `.env` 并根据您的环境修改：
```bash
cp .env.example .env
```

**重要配置项：**
- `DATABASE_URL`: PostgreSQL 连接字符串
- `JWT_SECRET`: JWT 密钥（生产环境请使用强密码）
- 其他服务（Redis、S3/MinIO）的连接信息

#### 初始化数据库
```bash
# 生成 Prisma 客户端
npm run db:generate

# 运行数据库迁移
npm run db:migrate

# 创建默认管理员用户
npm run db:seed
```

**默认管理员账户：**
- 邮箱: `admin@uitrace.com`
- 密码: `admin123`

#### 启动后端服务
```bash
npm run dev
```

### 2. 前端设置

#### 配置环境变量
编辑 `frontend/.env`:
```bash
# 使用真实数据（不是 mock）
VITE_ENABLE_MOCK_DATA=false

# API 配置
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_WS_URL=ws://localhost:3000
```

#### 启动前端服务
```bash
cd frontend
npm install
npm run dev
```

### 3. 访问应用

打开浏览器访问 `http://localhost:5173`，您将看到登录页面。

使用以下凭据登录：
- **邮箱**: admin@uitrace.com
- **密码**: admin123

## 🔐 功能特性

### 已实现的认证功能
- ✅ 用户注册
- ✅ 用户登录
- ✅ JWT Token 认证
- ✅ 密码哈希加密（bcrypt）
- ✅ 角色管理（ADMIN/USER/VIEWER）
- ✅ WebSocket 认证
- ✅ 受保护的路由

### API 端点
- `POST /api/v1/auth/register` - 注册新用户
- `POST /api/v1/auth/login` - 用户登录
- `POST /api/v1/auth/logout` - 用户登出
- `GET /api/v1/auth/me` - 获取当前用户信息

### 数据库模型
新的 `User` 模型已添加到 Prisma schema:
```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String   // bcrypt 哈希
  name      String?
  role      UserRole @default(USER)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## 🛠️ 开发和测试

### 创建新用户
您可以通过以下方式创建新用户：

1. **通过 API**:
   ```bash
   curl -X POST http://localhost:3000/api/v1/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "email": "user@example.com",
       "password": "password123",
       "name": "Test User"
     }'
   ```

2. **通过前端注册页面**: 访问 `/login` 并点击 "Don't have an account? Sign up"

### 切换到 Mock 模式
如果您想回到模拟数据模式，编辑 `frontend/.env`:
```bash
VITE_ENABLE_MOCK_DATA=true
```

## 🔒 安全注意事项

1. **生产环境配置**:
   - 使用强密码作为 `JWT_SECRET`
   - 配置 HTTPS
   - 使用环境变量管理敏感信息
   - 定期更新依赖包

2. **密码策略**:
   - 最小长度建议 8 位
   - 包含大小写字母、数字和特殊字符
   - 实施密码过期策略

3. **数据库安全**:
   - 使用专用数据库用户
   - 限制数据库访问权限
   - 启用 SSL 连接

## 🐛 故障排除

### 问题 1: "Authentication Required" 错误
**原因**: Token 未正确传递
**解决方案**:
- 确保用户已登录
- 清除浏览器 localStorage 并重新登录
- 检查 WebSocket 连接是否包含认证信息

### 问题 2: 数据库连接失败
**原因**: DATABASE_URL 配置错误
**解决方案**:
- 检查 PostgreSQL 服务是否运行
- 验证连接字符串格式
- 确认数据库用户权限

### 问题 3: Prisma 客户端版本不匹配
**解决方案**:
```bash
npm run db:generate
npm run db:migrate
```

## 📚 更多信息

- [Prisma 文档](https://www.prisma.io/docs/)
- [Fastify JWT 插件](https://github.com/fastify/fastify-jwt)
- [bcrypt 加密](https://github.com/kelektiv/node.bcrypt.js)

## 🤝 贡献

如果您发现问题或有改进建议，请提交 Issue 或 Pull Request。
