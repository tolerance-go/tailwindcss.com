# 源码输入

- platform

  - node

    - `src/**`

      - language
        - js
      - module
        - esm
      - target(语言标准及环境版本)
        - ESNext

  - node

    - `getUtilities`

      - language
        - js
      - module
        - cjs
      - target(语言标准及环境版本)
        - ESNext

# 模块导出

- exports

  - platform

    - browser

      - dist/*
        - language
          - js
        - target
          - es5
          - DOM3
        - module
          - iife
        - types

    - node

      - getUtilities
        - language
          - js
        - target
          - esnext
          - node@13
        - module
          - cjs
        - types

    - native

      - src/utils/defaultTransformSelector
        - language
          - js
        - target
          - esnext
        - module
          - cjs
        - types

## 命令行导出

### 初始化

install

### 重置


### 代码格式化

format

### 代码检查

### 开发

### 生成

### 测试

### 框架

### 构建


#### 打包器

next

### 发布

### 部署

####

# 开发流程

# 测试流程

# 打包流程

# 部署流程
