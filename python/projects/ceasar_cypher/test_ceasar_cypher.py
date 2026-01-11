import unittest
import ceasar_cypher_functions

class CaesarCipherTestCase(unittest.TestCase):
    
    def test_encrypt(self):
        plaintext = "HelLo, WoRld!"
        encrypted = ceasar_cypher_functions.ceasar_cypher_encode(plaintext, 3)
        self.assertEqual(encrypted, "KhoOr, ZrUog!")

    def test_decrypt(self):
        ciphertext = "Khoor, Zruog!"
        decrypted = ceasar_cypher_functions.ceasar_cypher_decode(ciphertext, 3)
        self.assertEqual(decrypted, "Hello, World!")

    def test_encrypt_large_shift(self):
        plaintext = "Hello, World!"
        encrypted = ceasar_cypher_functions.ceasar_cypher_encode(plaintext, 355)
        self.assertEqual(encrypted, "Yvccf, Nficu!")

    def test_decrypt_large_shift(self):
        ciphertext = "Yvccf, Nficu!"
        decrypted = ceasar_cypher_functions.ceasar_cypher_decode(ciphertext, 355)
        self.assertEqual(decrypted, "Hello, World!")


    def test_encrypt_negative_shift(self):
        plaintext = "Hello, World!"
        encrypted = ceasar_cypher_functions.ceasar_cypher_encode(plaintext, -3)
        self.assertEqual(encrypted, "Ebiil, Tloia!")

    def test_decrypt_negative_shift(self):
        ciphertext = "Ebiil, Tloia!"
        decrypted = ceasar_cypher_functions.ceasar_cypher_decode(ciphertext, -3)
        self.assertEqual(decrypted, "Hello, World!")

if __name__ == "__main__":
    unittest.main()