"""Module providing function for encoding and decoding a ceasar cypher."""
import ceasar_cypher_functions


while True:
    text = input("Type your message:\n")
    shift = int(input("Type the shift number:\n"))
    direction = input("Type 'encode' to encrypt, type 'decode' to decrypt:\n")

    if direction == "encode":
        encoded_string = ceasar_cypher_functions.ceasar_cypher_encode(text, shift)
        print(encoded_string)
        break

    elif direction == "decode":
        decoded_string = ceasar_cypher_functions.ceasar_cypher_decode(text, shift)
        print(decoded_string)
    else:
        print("Command not correct")
