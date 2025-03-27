/**
 * 请求预处理组件测试
 */
const { 
  processRequest, 
  standardizeRequest, 
  performSecurityCheck, 
  extractMetadata 
} = require('../src/middleware/requestProcessor');
const { GatewayError } = require('../src/utils/errors');

// 模拟请求对象
const mockRequest = {
  query: '这是一个测试查询',
  metadata: {
    source: 'test'
  }
};

// 测试请求标准化
describe('标准化请求', () => {
  test('应该为请求添加请求ID', () => {
    const result = standardizeRequest({ ...mockRequest });
    expect(result.request_id).toBeDefined();
    expect(typeof result.request_id).toBe('string');
  });
  
  test('应该保留现有的请求ID', () => {
    const requestWithId = { 
      ...mockRequest, 
      request_id: 'test-id-123' 
    };
    const result = standardizeRequest(requestWithId);
    expect(result.request_id).toBe('test-id-123');
  });
  
  test('应该确保元数据存在', () => {
    const requestWithoutMetadata = { 
      query: '这是一个测试查询' 
    };
    const result = standardizeRequest(requestWithoutMetadata);
    expect(result.metadata).toBeDefined();
    expect(typeof result.metadata).toBe('object');
  });
  
  test('应该添加时间戳到元数据', () => {
    const result = standardizeRequest({ ...mockRequest });
    expect(result.metadata.timestamp).toBeDefined();
    // 验证时间戳格式
    expect(() => new Date(result.metadata.timestamp)).not.toThrow();
  });
});

// 测试安全检查
describe('安全检查', () => {
  test('应该通过有效请求', () => {
    expect(() => performSecurityCheck(mockRequest)).not.toThrow();
  });
  
  test('应该拒绝没有查询的请求', () => {
    const invalidRequest = { metadata: {} };
    expect(() => performSecurityCheck(invalidRequest)).toThrow(GatewayError);
  });
  
  test('应该拒绝包含潜在危险内容的请求', () => {
    const dangerousRequest = { 
      ...mockRequest, 
      query: 'exec(危险命令)' 
    };
    expect(() => performSecurityCheck(dangerousRequest)).toThrow(GatewayError);
  });
});

// 测试元数据提取
describe('元数据提取', () => {
  test('应该提取查询长度', () => {
    const result = extractMetadata(mockRequest);
    expect(result.queryLength).toBe(mockRequest.query.length);
  });
  
  test('应该提取单词数量', () => {
    const request = { 
      ...mockRequest, 
      query: '这是 一个 测试 查询' 
    };
    const result = extractMetadata(request);
    expect(result.wordCount).toBe(4);
  });
  
  test('应该包含时间戳', () => {
    const result = extractMetadata(mockRequest);
    expect(result.timestamp).toBeDefined();
  });
  
  test('应该保留原始元数据', () => {
    const result = extractMetadata(mockRequest);
    expect(result.source).toBe('test');
  });
});

// 测试完整的请求处理流程
describe('请求处理流程', () => {
  test('应该成功处理有效请求', () => {
    const result = processRequest(mockRequest);
    expect(result.request).toBeDefined();
    expect(result.metadata).toBeDefined();
    expect(result.logger).toBeDefined();
  });
  
  test('应该抛出错误当处理无效请求', () => {
    const invalidRequest = {};
    expect(() => processRequest(invalidRequest)).toThrow();
  });
});