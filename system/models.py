import os
from openai import OpenAI
from mistralai import Mistral
from dotenv import load_dotenv

class AIModel:
  def __init__(self):
    self.name
    self.key
    self.client

  def generate_client(self):
    """
    Create and return a client object based on the model name.
    Override this method in a subclass with the specific client implementation.
    """
    raise NotImplementedError("This method should be overridden to generate a client based on the model name.")

  def generate_response(self, prompt: str):
    """
    Generate and return a response for the provided prompt.
    Override this method in a subclass with the specific response generation implementation.
    """
    raise NotImplementedError("This method should be overridden to generate a response.")

class DeepseekModel(AIModel):
  def __init__(self):
    load_dotenv()
    self.name = os.getenv("DEEPSEEK_NAME")
    self.key =  os.getenv("DEEPSEEK_KEY")
    self.client = OpenAI(api_key=self.key, base_url="https://api.deepseek.com")

  def generate_response(self, prompt: str):
    response = self.client.chat.completions.create(
        model=self.name,
        messages=[
          {"role": "system", "content": "You are a helpful educational assistant."},
          {"role": "user", "content": prompt},
        ],
        stream=False
      )
    return response

class MistralModel(AIModel):
  def __init__(self):
    load_dotenv()
    self.name = os.getenv("MISTRAL_NAME")
    self.key =  os.getenv("MISTRAL_KEY")
    self.client = Mistral(api_key=self.key)

  def generate_response(self, prompt: str):
    response = self.client.chat.complete(
    model= self.name,
    messages = [
        {"role": "system", "content": "You are a helpful educational assistant."},
        {"role": "user", "content": prompt},
      ]
    )
    return response