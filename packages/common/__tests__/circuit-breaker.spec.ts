import {
  CircuitBreakerManager,
  createCircuitBreaker,
  CircuitOpenError,
} from "../src/providers/resilience/circuit-breaker";
import {
  CircuitState,
  CircuitBreakerConfig,
  DEFAULT_CIRCUIT_CONFIGS,
} from "../src/providers/resilience/types";

describe("CircuitBreakerManager", () => {
  const testConfig: CircuitBreakerConfig = {
    failureThreshold: 3,
    halfOpenAfterMs: 100, // Short for testing
    serviceName: "TestService",
  };

  let manager: CircuitBreakerManager;

  beforeEach(() => {
    manager = new CircuitBreakerManager(testConfig);
  });

  describe("constructor", () => {
    it("should create a circuit breaker with the given config", () => {
      expect(manager).toBeDefined();
      expect(manager.getConfig()).toEqual(testConfig);
    });

    it("should initialize in closed state", () => {
      expect(manager.getState()).toBe(CircuitState.CLOSED);
    });

    it("should be healthy initially", () => {
      expect(manager.isHealthy()).toBe(true);
    });
  });

  describe("execute", () => {
    it("should execute successful async functions", async () => {
      const result = await manager.execute(async () => "success");
      expect(result).toBe("success");
    });

    it("should propagate errors from the function", async () => {
      await expect(
        manager.execute(async () => {
          throw new Error("Test error");
        }),
      ).rejects.toThrow("Test error");
    });

    it("should track failures and increment failure count", async () => {
      expect(manager.getHealth().failureCount).toBe(0);

      await manager
        .execute(async () => {
          throw new Error("Failure");
        })
        .catch(() => {});

      expect(manager.getHealth().failureCount).toBe(1);
    });

    it("should reset failure count on success", async () => {
      // First fail
      await manager
        .execute(async () => {
          throw new Error("Failure");
        })
        .catch(() => {});

      expect(manager.getHealth().failureCount).toBe(1);

      // Then succeed
      await manager.execute(async () => "success");

      expect(manager.getHealth().failureCount).toBe(0);
    });

    it("should throw CircuitOpenError when circuit is open", async () => {
      // Open the circuit by failing multiple times
      for (let i = 0; i < testConfig.failureThreshold; i++) {
        await manager
          .execute(async () => {
            throw new Error("Failure");
          })
          .catch(() => {});
      }

      // Next call should get CircuitOpenError
      await expect(
        manager.execute(async () => "should not execute"),
      ).rejects.toThrow(CircuitOpenError);
    });
  });

  describe("getState", () => {
    it("should return CLOSED initially", () => {
      expect(manager.getState()).toBe(CircuitState.CLOSED);
    });

    it("should return OPEN after threshold failures", async () => {
      for (let i = 0; i < testConfig.failureThreshold; i++) {
        await manager
          .execute(async () => {
            throw new Error("Failure");
          })
          .catch(() => {});
      }

      expect(manager.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe("getHealth", () => {
    it("should return complete health information", () => {
      const health = manager.getHealth();

      expect(health).toEqual({
        serviceName: "TestService",
        state: CircuitState.CLOSED,
        isHealthy: true,
        failureCount: 0,
        lastFailure: undefined,
        lastSuccess: undefined,
      });
    });

    it("should track last success timestamp", async () => {
      const beforeTime = new Date();
      await manager.execute(async () => "success");
      const afterTime = new Date();

      const health = manager.getHealth();
      expect(health.lastSuccess).toBeDefined();
      expect(health.lastSuccess!.getTime()).toBeGreaterThanOrEqual(
        beforeTime.getTime(),
      );
      expect(health.lastSuccess!.getTime()).toBeLessThanOrEqual(
        afterTime.getTime(),
      );
    });

    it("should track last failure timestamp", async () => {
      const beforeTime = new Date();
      await manager
        .execute(async () => {
          throw new Error("Failure");
        })
        .catch(() => {});
      const afterTime = new Date();

      const health = manager.getHealth();
      expect(health.lastFailure).toBeDefined();
      expect(health.lastFailure!.getTime()).toBeGreaterThanOrEqual(
        beforeTime.getTime(),
      );
      expect(health.lastFailure!.getTime()).toBeLessThanOrEqual(
        afterTime.getTime(),
      );
    });

    it("should report unhealthy when circuit is open", async () => {
      for (let i = 0; i < testConfig.failureThreshold; i++) {
        await manager
          .execute(async () => {
            throw new Error("Failure");
          })
          .catch(() => {});
      }

      const health = manager.getHealth();
      expect(health.isHealthy).toBe(false);
      expect(health.state).toBe(CircuitState.OPEN);
    });
  });

  describe("isHealthy", () => {
    it("should return true when circuit is closed", () => {
      expect(manager.isHealthy()).toBe(true);
    });

    it("should return false when circuit is open", async () => {
      for (let i = 0; i < testConfig.failureThreshold; i++) {
        await manager
          .execute(async () => {
            throw new Error("Failure");
          })
          .catch(() => {});
      }

      expect(manager.isHealthy()).toBe(false);
    });
  });

  describe("event listeners", () => {
    it("should notify listeners on failure", async () => {
      const listener = jest.fn();
      manager.addListener(listener);

      await manager
        .execute(async () => {
          throw new Error("Failure");
        })
        .catch(() => {});

      expect(listener).toHaveBeenCalledWith("failure");
    });

    it("should notify listeners on success", async () => {
      const listener = jest.fn();
      manager.addListener(listener);

      await manager.execute(async () => "success");

      expect(listener).toHaveBeenCalledWith("success");
    });

    it("should notify listeners on break", async () => {
      const listener = jest.fn();
      manager.addListener(listener);

      for (let i = 0; i < testConfig.failureThreshold; i++) {
        await manager
          .execute(async () => {
            throw new Error("Failure");
          })
          .catch(() => {});
      }

      expect(listener).toHaveBeenCalledWith("break");
    });

    it("should allow removing listeners", async () => {
      const listener = jest.fn();
      manager.addListener(listener);
      manager.removeListener(listener);

      await manager.execute(async () => "success");

      expect(listener).not.toHaveBeenCalled();
    });

    it("should not throw if listener throws", async () => {
      const throwingListener = () => {
        throw new Error("Listener error");
      };
      manager.addListener(throwingListener);

      // Should not throw
      await expect(manager.execute(async () => "success")).resolves.toBe(
        "success",
      );
    });
  });

  describe("getPolicy", () => {
    it("should return the underlying circuit breaker policy", () => {
      const policy = manager.getPolicy();
      expect(policy).toBeDefined();
      expect(typeof policy.execute).toBe("function");
    });
  });

  describe("getConfig", () => {
    it("should return a copy of the config", () => {
      const config = manager.getConfig();
      expect(config).toEqual(testConfig);
      expect(config).not.toBe(testConfig); // Should be a copy
    });
  });
});

describe("createCircuitBreaker", () => {
  it("should create a CircuitBreakerManager", () => {
    const config: CircuitBreakerConfig = {
      failureThreshold: 5,
      halfOpenAfterMs: 1000,
      serviceName: "TestService",
    };

    const manager = createCircuitBreaker(config);

    expect(manager).toBeInstanceOf(CircuitBreakerManager);
    expect(manager.getConfig()).toEqual(config);
  });
});

describe("CircuitOpenError", () => {
  it("should create error with service name", () => {
    const error = new CircuitOpenError("MyService");

    expect(error.message).toBe(
      "Circuit breaker open for MyService - service unavailable",
    );
    expect(error.name).toBe("CircuitOpenError");
    expect(error.serviceName).toBe("MyService");
    expect(error.originalError).toBeUndefined();
  });

  it("should include original error if provided", () => {
    const originalError = new Error("Original");
    const error = new CircuitOpenError("MyService", originalError);

    expect(error.originalError).toBe(originalError);
  });
});

describe("DEFAULT_CIRCUIT_CONFIGS", () => {
  it("should have ollama config", () => {
    expect(DEFAULT_CIRCUIT_CONFIGS.ollama).toEqual({
      failureThreshold: 3,
      halfOpenAfterMs: 30000,
      serviceName: "Ollama",
    });
  });

  it("should have supabase config", () => {
    expect(DEFAULT_CIRCUIT_CONFIGS.supabase).toEqual({
      failureThreshold: 5,
      halfOpenAfterMs: 10000,
      serviceName: "Supabase",
    });
  });

  it("should have extraction config", () => {
    expect(DEFAULT_CIRCUIT_CONFIGS.extraction).toEqual({
      failureThreshold: 5,
      halfOpenAfterMs: 60000,
      serviceName: "Extraction",
    });
  });
});

describe("CircuitState enum", () => {
  it("should have correct values", () => {
    expect(CircuitState.CLOSED).toBe("closed");
    expect(CircuitState.OPEN).toBe("open");
    expect(CircuitState.HALF_OPEN).toBe("half_open");
  });
});
