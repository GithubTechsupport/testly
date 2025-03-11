def function_timer(func):
    def wrapper(*args, **kwargs):
      start_time = time.time()
      result = func(*args, **kwargs)
      end_time = time.time()
      print(f"Function {func.__name__} took {end_time - start_time} seconds")
      return result
    return wrapper