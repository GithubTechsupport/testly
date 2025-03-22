import requests

def get_api_response(url):
  try:
    response = requests.get(url)
    response.raise_for_status()
    return response.text  # returning the raw text response
  except requests.RequestException as error:
    print("Failed to fetch data:", error)
    return None

def write_response_to_file(filename, data):
  with open(filename, 'w', encoding='utf-8') as file:
    file.write(data)

if __name__ == "__main__":
  api_url = "https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=60&lon=11"
  response_text = get_api_response(api_url)
  
  if response_text:
    output_file = "weather_response.txt"
    write_response_to_file(output_file, response_text)
    print("Response written to", output_file)
  else:
    print("No response received from the API.")